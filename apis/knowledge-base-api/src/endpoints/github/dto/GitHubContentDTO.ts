import { AdditionalProperties, Enum, Property } from '@tsed/schema';
import { GitHubContentTypeDTO } from './GitHubContentTypeDTO.enum.js';

/** `GET /repos/{owner}/{repo}/contents/{path}` for a file. */
@AdditionalProperties(false)
export class GitHubContentDTO {
    @Enum(GitHubContentTypeDTO) public type: GitHubContentTypeDTO;
    @Property() public path: string;
    /** The file's blob SHA — what a `PUT` or `DELETE` of it must send as `sha`. */
    @Property() public sha: string;
    /** The file, encoded as `encoding` says: `base64` up to 1 MB, `none` (and empty) above. */
    @Property() public content: string;
    @Property() public encoding: string;
}
