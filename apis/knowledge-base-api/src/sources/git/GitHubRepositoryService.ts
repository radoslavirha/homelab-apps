import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils, DefaultsUtil } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { GitHubEndpoint } from '../../endpoints/github/GitHubEndpoint.js';
import type { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import { type GitHubConfig, gitHubCredentialKey } from '../../models/config/GitHubConfig.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import { ConfigService } from '../../services/ConfigService.js';

/**
 * The repository a git knowledge base reads, picked from the ones its GitHub App's installations
 * cover, or — with a token — read directly. One App or token can serve several knowledge bases, or
 * a knowledge base can have its own in `git.github`.
 *
 * With `git.repository` set, it is that one, and an App that does not cover it is refused. Without,
 * the App must cover exactly one: guessing would index the wrong repository. A token always names
 * it (the config schema refuses one without), and GitHub answering 404 is the refusal.
 *
 * The name never appears in this repo or in the deployment values: the deployment reads
 * `git.repository` from a secret. The refusals here leave it out too, since a run's error is
 * recorded with the run.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class GitHubRepositoryService {
    /** One discovery per credential and repository: two knowledge bases on one App each get their own. */
    private readonly discoveries = new Map<string, Promise<GitHubRepositoryDTO>>();
    private readonly log: BaseLogger;

    public constructor(
        private readonly github: GitHubEndpoint,
        private readonly configService: ConfigService,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('GITHUB');
    }

    /** The knowledge base's repository, discovered once and remembered until {@link forget}. */
    public repository(kb: GitKnowledgeBaseConfig): Promise<GitHubRepositoryDTO> {
        const key = this.discoveryKey(kb);
        let discovery = this.discoveries.get(key);

        if (CommonUtils.isUndefined(discovery)) {
            discovery = this.discover(kb).catch((error: unknown) => {
                this.discoveries.delete(key);
                throw error;
            });
            this.discoveries.set(key, discovery);
        }

        return discovery;
    }

    /**
     * Discover again on the next call — after a failure, the installation may have changed or the
     * token been rotated. Only this knowledge base's entry: another one on the same App keeps its
     * repository.
     */
    public forget(kb: GitKnowledgeBaseConfig): void {
        this.discoveries.delete(this.discoveryKey(kb));
    }

    /** The knowledge base's own credentials, or the root ones. The config schema refuses a git knowledge base with neither. */
    private credentials(kb: GitKnowledgeBaseConfig): GitHubConfig {
        return kb.git.github ?? this.configService.config.github!;
    }

    /** Knowledge bases naming one repository in different spellings share a discovery. */
    private discoveryKey(kb: GitKnowledgeBaseConfig): string {
        return `${gitHubCredentialKey(this.credentials(kb))}:${DefaultsUtil.string(kb.git.repository, '').toLowerCase()}`;
    }

    private async discover(kb: GitKnowledgeBaseConfig): Promise<GitHubRepositoryDTO> {
        const credentials = this.credentials(kb);
        const repository = credentials.type === 'token'
            ? await this.github.getRepository(credentials, this.named(kb))
            : this.pick(kb, await this.github.listRepositories(credentials));

        this.log.info(credentials.type === 'token'
            ? 'Knowledge base repository found with the GitHub token.'
            : 'Knowledge base repository found through the GitHub App installation.', {
            event: 'GITHUB_REPOSITORY',
            repository: `${repository.owner.login}/${repository.name}`,
            defaultBranch: repository.defaultBranch
        });

        return repository;
    }

    /** `git.repository` of a knowledge base on a token. The config schema already refuses one without it. */
    private named(kb: GitKnowledgeBaseConfig): string {
        const repository = kb.git.repository;

        if (CommonUtils.isUndefined(repository)) {
            throw new Error(`Knowledge base ${kb.id} reads GitHub with a token, which needs git.repository.`);
        }

        return repository;
    }

    private pick(kb: GitKnowledgeBaseConfig, repositories: GitHubRepositoryDTO[]): GitHubRepositoryDTO {
        const configured = kb.git.repository;

        if (CommonUtils.notUndefined(configured)) {
            // GitHub treats names case-insensitively, and lists them in their own spelling.
            const repository = repositories.find((candidate) => `${candidate.owner.login}/${candidate.name}`.toLowerCase() === configured.toLowerCase());

            if (CommonUtils.isUndefined(repository)) {
                throw new Error(`The GitHub App of knowledge base ${kb.id} does not cover its git.repository; it can read ${repositories.length} repositories.`);
            }

            return repository;
        }

        if (repositories.length > 1) {
            throw new Error(`The GitHub App can read ${repositories.length} repositories; the git source needs exactly one. Set git.repository on knowledge base ${kb.id} to choose.`);
        }

        if (repositories.length !== 1) {
            throw new Error(`The GitHub App can read ${repositories.length} repositories; the git source needs exactly one.`);
        }

        return repositories[0];
    }
}
