import { AdditionalProperties, Property } from '@tsed/schema';

/** `GET /repos/{owner}/{repo}/git/blobs/{sha}`. */
@AdditionalProperties(false)
export class GitHubBlobDTO {
    @Property() public sha: string;
    /** The file, encoded as `encoding` says — `base64` in practice. */
    @Property() public content: string;
    @Property() public encoding: string;
}
