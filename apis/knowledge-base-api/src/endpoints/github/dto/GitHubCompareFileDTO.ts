import { AdditionalProperties, Enum, Name, Nullable, Optional, Property } from '@tsed/schema';
import { GitHubFileStatusDTO } from './GitHubFileStatusDTO.enum.js';

/** One changed file of a compare. */
@AdditionalProperties(false)
export class GitHubCompareFileDTO {
    @Property() public filename: string;
    @Enum(GitHubFileStatusDTO) public status: GitHubFileStatusDTO;
    /** Blob SHA of the file at head; null when there is no blob to read (a submodule). */
    @Nullable(String) public sha: string | null;
    @Optional() @Property() @Name('previous_filename') public previousFilename?: string;
}
