import { AdditionalProperties, Name, Property } from '@tsed/schema';
import { GitHubAccountDTO } from './GitHubAccountDTO.js';

/** A repository one of the App's installations can read. */
@AdditionalProperties(false)
export class GitHubRepositoryDTO {
    @Property() public name: string;
    @Property(GitHubAccountDTO) public owner: GitHubAccountDTO;
    @Property() @Name('default_branch') public defaultBranch: string;
    @Property() @Name('html_url') public htmlUrl: string;
}
