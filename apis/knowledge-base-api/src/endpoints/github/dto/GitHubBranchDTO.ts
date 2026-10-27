import { AdditionalProperties, Property } from '@tsed/schema';
import { GitHubCommitRefDTO } from './GitHubCommitRefDTO.js';

/** `GET /repos/{owner}/{repo}/branches/{branch}`. */
@AdditionalProperties(false)
export class GitHubBranchDTO {
    @Property() public name: string;
    @Property(GitHubCommitRefDTO) public commit: GitHubCommitRefDTO;
}
