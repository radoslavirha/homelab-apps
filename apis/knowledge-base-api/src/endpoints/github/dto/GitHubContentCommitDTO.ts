import { AdditionalProperties, Nullable, Property } from '@tsed/schema';
import { GitHubCommitRefDTO } from './GitHubCommitRefDTO.js';
import { GitHubContentRefDTO } from './GitHubContentRefDTO.js';

/** The answer of `PUT` and `DELETE /repos/{owner}/{repo}/contents/{path}`: the file and the commit made. */
@AdditionalProperties(false)
export class GitHubContentCommitDTO {
    /** The file as written; `null` after a delete. */
    @Nullable(GitHubContentRefDTO) public content: GitHubContentRefDTO | null;
    @Property(GitHubCommitRefDTO) public commit: GitHubCommitRefDTO;
}
