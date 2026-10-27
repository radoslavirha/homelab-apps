import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { GitHubEndpoint } from '../../endpoints/github/GitHubEndpoint.js';
import type { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';

/**
 * The repository the git source reads, found by asking the GitHub App's installations which
 * repositories they cover — so the name is never configured, and never appears in this repo
 * or in the deployment values.
 *
 * Exactly one repository is required. The App is installed on the knowledge base repository
 * and nowhere else; a second installation would make the choice ambiguous, and guessing would
 * index the wrong repository. A second git knowledge base needs a way to tell them apart
 * (e.g. a repository custom property) before it can exist.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class GitHubRepositoryService {
    private discovery: Promise<GitHubRepositoryDTO> | undefined;
    private readonly log: BaseLogger;

    public constructor(
        private readonly github: GitHubEndpoint,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('GITHUB');
    }

    /** The repository, discovered once and remembered until {@link forget}. */
    public repository(): Promise<GitHubRepositoryDTO> {
        this.discovery ??= this.discover().catch((error: unknown) => {
            this.discovery = undefined;
            throw error;
        });

        return this.discovery;
    }

    /** Discover again on the next call — after a failure, the installation may have changed. */
    public forget(): void {
        this.discovery = undefined;
    }

    private async discover(): Promise<GitHubRepositoryDTO> {
        const repositories = await this.github.listRepositories();

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
