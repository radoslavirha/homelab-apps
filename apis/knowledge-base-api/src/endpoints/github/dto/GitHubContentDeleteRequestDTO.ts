import { AdditionalProperties, Property } from '@tsed/schema';

/** Body of `DELETE /repos/{owner}/{repo}/contents/{path}`: deletes one file in one commit. */
@AdditionalProperties(false)
export class GitHubContentDeleteRequestDTO {
    @Property() public message: string;
    /** Blob SHA of the file being deleted; GitHub refuses the commit when the branch holds another. */
    @Property() public sha: string;
    @Property() public branch: string;
}
