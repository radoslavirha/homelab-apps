import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { GitHubEndpoint } from '../../endpoints/github/GitHubEndpoint.js';
import type { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import type { GitHubAppConfig } from '../../models/config/GitHubAppConfig.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import { ConfigService } from '../../services/ConfigService.js';

/**
 * The repository a git knowledge base reads, found by asking its GitHub App's installations which
 * repositories they cover — so the name is never configured, and never appears in this repo
 * or in the deployment values.
 *
 * Exactly one repository per App is required. An App is installed on its knowledge base's
 * repository and nowhere else; a second installation would make the choice ambiguous, and guessing
 * would index the wrong repository. A second repository is a second App, in the knowledge base's
 * `git.github`.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class GitHubRepositoryService {
    /** One discovery per App, by client ID: knowledge bases on one App share its one repository. */
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
        const app = this.app(kb);
        let discovery = this.discoveries.get(app.clientId);

        if (CommonUtils.isUndefined(discovery)) {
            discovery = this.discover(app).catch((error: unknown) => {
                this.discoveries.delete(app.clientId);
                throw error;
            });
            this.discoveries.set(app.clientId, discovery);
        }

        return discovery;
    }

    /** Discover again on the next call — after a failure, the installation may have changed. */
    public forget(kb: GitKnowledgeBaseConfig): void {
        this.discoveries.delete(this.app(kb).clientId);
    }

    /** The knowledge base's own App, or the root one. The config schema refuses a git knowledge base with neither. */
    private app(kb: GitKnowledgeBaseConfig): GitHubAppConfig {
        return kb.git.github ?? this.configService.config.github!;
    }

    private async discover(app: GitHubAppConfig): Promise<GitHubRepositoryDTO> {
        const repositories = await this.github.listRepositories(app);

        if (repositories.length !== 1) {
            throw new Error(`The GitHub App can read ${repositories.length} repositories; the git source needs exactly one.`);
        }

        const [repository] = repositories;

        this.log.info('Knowledge base repository found through the GitHub App installation.', {
            event: 'GITHUB_REPOSITORY',
            repository: `${repository.owner.login}/${repository.name}`,
            defaultBranch: repository.defaultBranch
        });

        return repository;
    }
}
