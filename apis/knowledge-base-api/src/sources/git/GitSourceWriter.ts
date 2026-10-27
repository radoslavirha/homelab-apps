import { CommonUtils } from '@radoslavirha/utils';
import { type GitHubEndpoint, isGitHubNotFound, isGitHubWriteRefusal } from '../../endpoints/github/GitHubEndpoint.js';
import { GitHubContentDeleteRequestDTO } from '../../endpoints/github/dto/GitHubContentDeleteRequestDTO.js';
import type { GitHubContentDTO } from '../../endpoints/github/dto/GitHubContentDTO.js';
import { GitHubContentPutRequestDTO } from '../../endpoints/github/dto/GitHubContentPutRequestDTO.js';
import { GitHubContentTypeDTO } from '../../endpoints/github/dto/GitHubContentTypeDTO.enum.js';
import type { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import { SourceWriteRefusedError } from '../SourceWriteRefusedError.js';
import type { SourceDeleteResult, SourceFile, SourceWriter, SourceWriteResult } from '../SourceWriter.js';
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
    public constructor(
        private readonly kb: GitKnowledgeBaseConfig,
        private readonly repositories: GitHubRepositoryService,
        private readonly github: GitHubEndpoint
    ) {}

    public async read(id: string): Promise<SourceFile | null> {
        const repository = await this.repositories.repository();
        let file: GitHubContentDTO;

        try {
            file = await this.github.getContent(repository, id, this.branch(repository));
        } catch (error) {
            if (isGitHubNotFound(error)) {
                return null;
            }

            throw error;
        }

        if (file.type !== GitHubContentTypeDTO.File || file.encoding !== 'base64') {
            throw new Error(`${id} is not a file the contents API can return whole.`);
        }

        return { content: Buffer.from(file.content, 'base64').toString('utf-8'), version: file.sha };
    }

    public async write(id: string, content: string, version: string | null, message: string): Promise<SourceWriteResult> {
        const repository = await this.repositories.repository();
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
        const repository = await this.repositories.repository();
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
