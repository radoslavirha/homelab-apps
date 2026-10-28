import { AdditionalProperties, Optional, Property } from '@tsed/schema';

/** Body of `PUT /repos/{owner}/{repo}/contents/{path}`: creates or replaces one file in one commit. */
@AdditionalProperties(false)
export class GitHubContentPutRequestDTO {
    @Property() public message: string;
    /** The whole new file, base64-encoded. */
    @Property() public content: string;
    /** Blob SHA of the file being replaced. Required to replace; absent to create, and GitHub refuses a create of a file that exists. */
    @Optional() @Property() public sha?: string;
    @Property() public branch: string;
}
