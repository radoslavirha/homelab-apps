import { readFileSync } from 'node:fs';
import { Serializer } from '@radoslavirha/tsed-common';
import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { InternalServerError } from '@tsed/exceptions';
import { App, Octokit, RequestError } from 'octokit';
import type { GitHubAppConfig, GitHubSecret } from '../../models/config/GitHubAppConfig.js';
import { gitHubCredentialKey } from '../../models/config/GitHubConfig.js';
import type { GitHubTokenConfig } from '../../models/config/GitHubTokenConfig.js';
import { ConfigService } from '../../services/ConfigService.js';
import { GitHubBlobDTO } from './dto/GitHubBlobDTO.js';
import { GitHubBranchDTO } from './dto/GitHubBranchDTO.js';
import { GitHubCompareDTO } from './dto/GitHubCompareDTO.js';
import { GitHubContentCommitDTO } from './dto/GitHubContentCommitDTO.js';
import { GitHubContentDeleteRequestDTO } from './dto/GitHubContentDeleteRequestDTO.js';
import { GitHubContentDTO } from './dto/GitHubContentDTO.js';
import { GitHubContentPutRequestDTO } from './dto/GitHubContentPutRequestDTO.js';
import { GitHubRepositoryDTO } from './dto/GitHubRepositoryDTO.js';
import { GitHubTreeDTO } from './dto/GitHubTreeDTO.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';

/** True for a GitHub 404 — a commit, tree or file that does not exist (any more). */
export const isGitHubNotFound = (error: unknown): boolean => error instanceof RequestError && error.status === 404;

/**
 * GitHub refusing a contents write: `409` and `422` (a `sha` that is not the file's, a create of a
 * file that exists — the docs list both without saying which case gets which) and `404` (the file
 * is gone). The status means nothing more; the caller reads the file to know why.
 */
export const isGitHubWriteRefusal = (error: unknown): boolean =>
    error instanceof RequestError && [404, 409, 422].includes(error.status);

/**
 * Statuses Octokit's retry plugin gives up on at once: its own defaults plus `409`, which they
 * leave out. A contents write refused for a stale `sha` is a 409 no retry can fix; retried, it
 * held the write queue for 14 s of backoff (1 + 4 + 9 s) before the caller heard of it. The option
 * replaces the defaults rather than adding to them, so they are repeated here.
 */
const DO_NOT_RETRY = [400, 401, 403, 404, 409, 410, 422, 451];

/** A repository's client, with the credential (`gitHubCredentialKey`) that discovered it. */
interface GitHubClient {
    readonly credential: string;
    readonly octokit: Octokit;
}

/**
 * GitHub, as the GitHub App or the token a knowledge base is configured with, through Octokit.
 *
 * Octokit owns the App's token dance: it signs the App JWT from the private key (PKCS#1 as
 * GitHub issues it), finds the installations, mints installation tokens and renews them before
 * they expire. Retries on server errors and waiting out rate limits are its plugins too; a
 * refusal is never retried ({@link DO_NOT_RETRY}).
 * `github.timeoutMs` bounds each attempt, not the call: see {@link fetchWithTimeout}.
 *
 * Every read takes an optional `signal` — the indexing run's — that aborts it, retries included.
 * The contents calls are the write path's: one file, and for `PUT`/`DELETE` one commit, per call.
 *
 * A token is plain `auth`, with the same client options. It has no installations to list:
 * {@link getRepository} reads the one repository it was configured for.
 *
 * {@link listRepositories} (an App) or {@link getRepository} (a token) must run first: it is what
 * discovers a repository and keeps a client for it. A call on a repository then goes as the
 * credential that discovered it.
 *
 * Accepts and returns DTOs only: every Octokit response is deserialized into its DTO class,
 * the same as an `http-provider` response would be.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class GitHubEndpoint {
    /** By client ID. */
    private readonly apps = new Map<string, App>();
    /** By repository, with the credential that discovered it. */
    private readonly clients = new Map<string, GitHubClient>();
    private readonly log: BaseLogger;

    public constructor(
        private readonly configService: ConfigService,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('GITHUB');
    }

    /**
     * Every repository any installation of the App can read. Another App's clients stay.
     *
     * The App's clients change only once the whole listing has succeeded, in one step: one
     * knowledge base's rediscovery runs while another's run or write is using a client of the same
     * App, and a listing that fails or is still running must not take that client away. A
     * repository the App no longer covers loses its client here.
     */
    public async listRepositories(config: GitHubAppConfig): Promise<GitHubRepositoryDTO[]> {
        const repositories: GitHubRepositoryDTO[] = [];
        const listed = new Map<string, GitHubClient>();
        const credential = gitHubCredentialKey(config);

        for await (const { octokit, repository } of this.getApp(config).eachRepository.iterator()) {
            const dto = Serializer.deserialize(repository, GitHubRepositoryDTO);

            listed.set(key(dto), { credential, octokit: octokit as unknown as Octokit });
            repositories.push(dto);
        }

        for (const [repository, client] of this.clients) {
            if (client.credential === credential && !listed.has(repository)) {
                this.clients.delete(repository);
            }
        }

        for (const [repository, client] of listed) {
            this.clients.set(repository, client);
        }

        return repositories;
    }

    /**
     * The one repository a token was configured for (`owner/name`), and a client for it.
     *
     * The client is built anew on every call, so the token is read again: a rotated token in the
     * mounted file takes effect at the next rediscovery, which follows a failed run. The client
     * replaces the repository's previous one only once GitHub has answered.
     */
    public async getRepository(config: GitHubTokenConfig, repository: string, signal?: AbortSignal): Promise<GitHubRepositoryDTO> {
        const [owner, repo] = repository.split('/');
        const octokit = new Octokit({ ...this.clientOptions(config), auth: readSecret(config.token) });
        const { data } = await octokit.rest.repos.get({ owner, repo, request: { signal } });
        const dto = Serializer.deserialize(data, GitHubRepositoryDTO);

        this.clients.set(key(dto), { credential: gitHubCredentialKey(config), octokit });

        return dto;
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

    /** One file on `ref` (a branch), with its blob SHA. A 404 when there is none. */
    public async getContent(repo: GitHubRepositoryDTO, path: string, ref: string): Promise<GitHubContentDTO> {
        const { data } = await this.client(repo).rest.repos.getContent({
            owner: repo.owner.login,
            repo: repo.name,
            path,
            ref
        });

        return Serializer.deserialize(data, GitHubContentDTO);
    }

    /** Creates or replaces one file, as one commit on the request's branch. */
    public async putContent(repo: GitHubRepositoryDTO, path: string, request: GitHubContentPutRequestDTO): Promise<GitHubContentCommitDTO> {
        const { data } = await this.client(repo).rest.repos.createOrUpdateFileContents({
            owner: repo.owner.login,
            repo: repo.name,
            path,
            // The wire names are the DTO's own: no field is renamed, so the serialized body has its type.
            ...Serializer.serialize(request, GitHubContentPutRequestDTO) as GitHubContentPutRequestDTO
        });

        return Serializer.deserialize(data, GitHubContentCommitDTO);
    }

    /** Deletes one file, as one commit on the request's branch. */
    public async deleteContent(repo: GitHubRepositoryDTO, path: string, request: GitHubContentDeleteRequestDTO): Promise<GitHubContentCommitDTO> {
        const { data } = await this.client(repo).rest.repos.deleteFile({
            owner: repo.owner.login,
            repo: repo.name,
            path,
            ...Serializer.serialize(request, GitHubContentDeleteRequestDTO) as GitHubContentDeleteRequestDTO
        });

        return Serializer.deserialize(data, GitHubContentCommitDTO);
    }

    private client(repo: GitHubRepositoryDTO): Octokit {
        const client = this.clients.get(key(repo));

        if (CommonUtils.isUndefined(client)) {
            throw new InternalServerError(`No GitHub client for ${key(repo)}; list repositories first.`);
        }

        return client.octokit;
    }

    private getApp(config: GitHubAppConfig): App {
        let app = this.apps.get(config.clientId);

        if (CommonUtils.isUndefined(app)) {
            app = new App({
                appId: config.clientId,
                privateKey: readSecret(config.privateKey),
                // Every request of the App and its installations, the repository listing included.
                Octokit: Octokit.defaults(this.clientOptions(config)),
                log: this.octokitLog()
            });
            this.apps.set(config.clientId, app);
        }

        return app;
    }

    /** Shared by an App's Octokit and a token's: what differs is only how they authenticate. */
    private clientOptions(config: GitHubAppConfig | GitHubTokenConfig): ConstructorParameters<typeof Octokit>[0] & object {
        return {
            baseUrl: config.baseUrl,
            userAgent: this.configService.api.service,
            retry: { retries: config.retries, doNotRetry: DO_NOT_RETRY },
            request: { fetch: fetchWithTimeout(config.timeoutMs) },
            log: this.octokitLog()
        };
    }

    private octokitLog(): { debug: (message: string) => void; info: (message: string) => void; warn: (message: string) => void; error: (message: string) => void } {
        return {
            debug: () => undefined,
            info: (message: string) => this.log.info(message, { event: 'GITHUB' }),
            warn: (message: string) => this.log.warn(message, { event: 'GITHUB' }),
            error: (message: string) => this.log.error(message, { event: 'GITHUB' })
        };
    }
}

/** A private key or token, from the config or the file it names. Never logged. */
const readSecret = (secret: GitHubSecret): string => secret.source === 'file' ? readFileSync(secret.path, 'utf-8').trim() : secret.value;

const key = (repo: GitHubRepositoryDTO): string => `${repo.owner.login}/${repo.name}`;
