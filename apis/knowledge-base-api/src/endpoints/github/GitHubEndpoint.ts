import { readFileSync } from 'node:fs';
import { Serializer } from '@radoslavirha/tsed-common';
import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { InternalServerError } from '@tsed/exceptions';
import { App, Octokit, RequestError } from 'octokit';
import type { GitHubAppConfig } from '../../models/config/GitHubAppConfig.js';
import { ConfigService } from '../../services/ConfigService.js';
import { GitHubBlobDTO } from './dto/GitHubBlobDTO.js';
import { GitHubBranchDTO } from './dto/GitHubBranchDTO.js';
import { GitHubCompareDTO } from './dto/GitHubCompareDTO.js';
import { GitHubRepositoryDTO } from './dto/GitHubRepositoryDTO.js';
import { GitHubTreeDTO } from './dto/GitHubTreeDTO.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';

/** True for a GitHub 404 — a commit, tree or file that does not exist (any more). */
export const isGitHubNotFound = (error: unknown): boolean => error instanceof RequestError && error.status === 404;

/**
 * GitHub, as the `knowledge-base-updater` GitHub App, through Octokit.
 *
 * Octokit owns the App's token dance: it signs the App JWT from the private key (PKCS#1 as
 * GitHub issues it), finds the installations, mints installation tokens and renews them before
 * they expire. Retries on server errors and waiting out rate limits are its plugins too.
 * `github.timeoutMs` bounds each attempt, not the call: see {@link fetchWithTimeout}.
 *
 * Every read takes an optional `signal` — the indexing run's — that aborts it, retries included.
 *
 * {@link listRepositories} must run first: it is what discovers which repositories the App
 * covers and keeps an installation client for each.
 *
 * Accepts and returns DTOs only: every Octokit response is deserialized into its DTO class,
 * the same as an `http-provider` response would be.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class GitHubEndpoint {
    private app: App | undefined;
    private readonly clients = new Map<string, Octokit>();
    private readonly log: BaseLogger;

    public constructor(
        private readonly configService: ConfigService,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('GITHUB');
    }

    /** Every repository any installation of the App can read. */
    public async listRepositories(): Promise<GitHubRepositoryDTO[]> {
        const repositories: GitHubRepositoryDTO[] = [];

        this.clients.clear();

        for await (const { octokit, repository } of this.getApp().eachRepository.iterator()) {
            const dto = Serializer.deserialize(repository, GitHubRepositoryDTO);

            this.clients.set(key(dto), octokit as unknown as Octokit);
            repositories.push(dto);
        }

        return repositories;
    }

    public async getBranch(repo: GitHubRepositoryDTO, branch: string, signal?: AbortSignal): Promise<GitHubBranchDTO> {
        const { data } = await this.client(repo).rest.repos.getBranch({
            owner: repo.owner.login,
            repo: repo.name,
            branch,
            request: { signal }
        });

        return Serializer.deserialize(data, GitHubBranchDTO);
    }

    /** What changed from `base` to `head`. Only the first page: it carries the whole file list. */
    public async compare(repo: GitHubRepositoryDTO, base: string, head: string, signal?: AbortSignal): Promise<GitHubCompareDTO> {
        const { data } = await this.client(repo).rest.repos.compareCommitsWithBasehead({
            owner: repo.owner.login,
            repo: repo.name,
            basehead: `${base}...${head}`,
            // Commits are paginated, files are not: page one lists every file (up to 300).
            per_page: 1,
            request: { signal }
        });

        return Serializer.deserialize(data, GitHubCompareDTO);
    }

    /** The whole tree of commit `sha`, recursively. */
    public async getTree(repo: GitHubRepositoryDTO, sha: string, signal?: AbortSignal): Promise<GitHubTreeDTO> {
        const { data } = await this.client(repo).rest.git.getTree({
            owner: repo.owner.login,
            repo: repo.name,
            tree_sha: sha,
            recursive: 'true',
            request: { signal }
        });

        return Serializer.deserialize(data, GitHubTreeDTO);
    }

    public async getBlob(repo: GitHubRepositoryDTO, sha: string, signal?: AbortSignal): Promise<GitHubBlobDTO> {
        const { data } = await this.client(repo).rest.git.getBlob({
            owner: repo.owner.login,
            repo: repo.name,
            file_sha: sha,
            request: { signal }
        });

        return Serializer.deserialize(data, GitHubBlobDTO);
    }

    private client(repo: GitHubRepositoryDTO): Octokit {
        const client = this.clients.get(key(repo));

        if (CommonUtils.isUndefined(client)) {
            throw new InternalServerError(`No GitHub installation client for ${key(repo)}; list repositories first.`);
        }

        return client;
    }

    private getApp(): App {
        if (CommonUtils.isUndefined(this.app)) {
            const config = this.config();

            this.app = new App({
                appId: config.clientId,
                privateKey: config.privateKey.source === 'file'
                    ? readFileSync(config.privateKey.path, 'utf-8')
                    : config.privateKey.value,
                Octokit: Octokit.defaults({
                    baseUrl: config.baseUrl,
                    userAgent: this.configService.api.service,
                    retry: { retries: config.retries },
                    // Every request of the App and its installations, the repository listing included.
                    request: { fetch: fetchWithTimeout(config.timeoutMs) }
                }),
                log: {
                    debug: () => undefined,
                    info: (message: string) => this.log.info(message, { event: 'GITHUB' }),
                    warn: (message: string) => this.log.warn(message, { event: 'GITHUB' }),
                    error: (message: string) => this.log.error(message, { event: 'GITHUB' })
                }
            });
        }

        return this.app;
    }

    private config(): GitHubAppConfig {
        const config = this.configService.config.github;

        if (CommonUtils.isUndefined(config)) {
            throw new InternalServerError('github is not configured.');
        }

        return config;
    }
}

const key = (repo: GitHubRepositoryDTO): string => `${repo.owner.login}/${repo.name}`;
