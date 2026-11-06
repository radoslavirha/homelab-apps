import { CommonUtils } from '@radoslavirha/utils';
import { type GitHubEndpoint, isGitHubWriteRefusal } from '../../endpoints/github/GitHubEndpoint.js';
import { GitHubContentDeleteRequestDTO } from '../../endpoints/github/dto/GitHubContentDeleteRequestDTO.js';
import { GitHubContentPutRequestDTO } from '../../endpoints/github/dto/GitHubContentPutRequestDTO.js';
import type { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import { SourceWriteRefusedError } from '../SourceWriteRefusedError.js';
import type { SourceDeleteResult, SourceFile, SourceWriter, SourceWriteResult } from '../SourceWriter.js';
import { GitFileReader } from './GitFileReader.js';
import type { GitHubRepositoryService } from './GitHubRepositoryService.js';

/**
 * Writes a git knowledge base through GitHub's contents API: one call per write, and GitHub makes
 * the commit — no clone, no push, no branch of our own. The commit is the App's.
 *
 * `version` is the file's blob SHA and is sent as `sha`: GitHub refuses the commit when the branch
 * holds another blob, and refuses a create (no `sha`) of a file that exists. Those refusals become
 * {@link SourceWriteRefusedError}; anything else (GitHub down, the App's key) is thrown as it is.
 *
 * Not a DI provider: one per git knowledge base, owned by its `GitSourceAdapter`.
 */
export class GitSourceWriter implements SourceWriter {
    private readonly reader: GitFileReader;

    public constructor(
        private readonly kb: GitKnowledgeBaseConfig,
        private readonly repositories: GitHubRepositoryService,
        private readonly github: GitHubEndpoint
    ) {
        this.reader = new GitFileReader(kb, repositories, github);
    }

    public read(id: string): Promise<SourceFile | null> {
        return this.reader.read(id);
    }

    public async write(id: string, content: string, version: string | null, message: string): Promise<SourceWriteResult> {
        const repository = await this.repositories.repository(this.kb);
        const request = CommonUtils.buildModelPartial(GitHubContentPutRequestDTO, {
            message,
            content: Buffer.from(content, 'utf-8').toString('base64'),
            branch: this.branch(repository),
            ...(CommonUtils.isNull(version) ? {} : { sha: version })
        });

        const result = await this.refusable(id, () => this.github.putContent(repository, id, request));

        // A PUT always answers the file it wrote.
        return { version: result.content!.sha, commit: result.commit.sha };
    }

    public async delete(id: string, version: string, message: string): Promise<SourceDeleteResult> {
        const repository = await this.repositories.repository(this.kb);
        const request = CommonUtils.buildModelStrict(GitHubContentDeleteRequestDTO, {
            message,
            sha: version,
            branch: this.branch(repository)
        });

        const result = await this.refusable(id, () => this.github.deleteContent(repository, id, request));

        return { commit: result.commit.sha };
    }

    private async refusable<T>(id: string, call: () => Promise<T>): Promise<T> {
        try {
            return await call();
        } catch (error) {
            if (isGitHubWriteRefusal(error)) {
                throw new SourceWriteRefusedError(id, { cause: error });
            }

            throw error;
        }
    }

    private branch(repository: GitHubRepositoryDTO): string {
        return this.kb.git.branch ?? repository.defaultBranch;
    }
}
