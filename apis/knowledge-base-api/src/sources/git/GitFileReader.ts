import { type GitHubEndpoint, isGitHubNotFound } from '../../endpoints/github/GitHubEndpoint.js';
import type { GitHubContentDTO } from '../../endpoints/github/dto/GitHubContentDTO.js';
import { GitHubContentTypeDTO } from '../../endpoints/github/dto/GitHubContentTypeDTO.enum.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import type { SourceFile } from '../SourceWriter.js';
import type { GitHubRepositoryService } from './GitHubRepositoryService.js';

/**
 * Reads one file of a git knowledge base as the branch holds it now, through GitHub's contents
 * API: its text and its blob SHA. Any path in the repository, not only what `git.include` indexes.
 *
 * Not a DI provider: one per git knowledge base, owned by its `GitSourceAdapter` and its writer.
 */
export class GitFileReader {
    public constructor(
        private readonly kb: GitKnowledgeBaseConfig,
        private readonly repositories: GitHubRepositoryService,
        private readonly github: GitHubEndpoint
    ) {}

    /** The file now, or `null` when the branch holds none at `path`. */
    public async read(path: string): Promise<SourceFile | null> {
        const repository = await this.repositories.repository(this.kb);
        let file: GitHubContentDTO;

        try {
            file = await this.github.getContent(repository, path, this.kb.git.branch ?? repository.defaultBranch);
        } catch (error) {
            if (isGitHubNotFound(error)) {
                return null;
            }

            throw error;
        }

        if (file.type !== GitHubContentTypeDTO.File || file.encoding !== 'base64') {
            throw new Error(`${path} is not a file the contents API can return whole.`);
        }

        return { content: Buffer.from(file.content, 'base64').toString('utf-8'), version: file.sha };
    }
}
