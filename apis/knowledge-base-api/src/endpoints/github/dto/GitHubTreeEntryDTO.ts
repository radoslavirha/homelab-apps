import { AdditionalProperties, Enum, Property } from '@tsed/schema';
import { GitHubTreeEntryTypeDTO } from './GitHubTreeEntryTypeDTO.enum.js';

/** One entry of a recursive tree listing. */
@AdditionalProperties(false)
export class GitHubTreeEntryDTO {
    @Property() public path: string;
    @Enum(GitHubTreeEntryTypeDTO) public type: GitHubTreeEntryTypeDTO;
    @Property() public sha: string;
}
