import { AdditionalProperties, CollectionOf, Property } from '@tsed/schema';
import { GitHubTreeEntryDTO } from './GitHubTreeEntryDTO.js';

/** `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=true`. */
@AdditionalProperties(false)
export class GitHubTreeDTO {
    @Property() public sha: string;
    /** GitHub cut the listing short (over 100,000 entries or 7 MB). */
    @Property() public truncated: boolean;
    @CollectionOf(GitHubTreeEntryDTO) public tree: GitHubTreeEntryDTO[];
}
