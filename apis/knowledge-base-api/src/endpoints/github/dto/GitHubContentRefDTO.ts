import { AdditionalProperties, Property } from '@tsed/schema';

/** The file a contents write left on the branch. */
@AdditionalProperties(false)
export class GitHubContentRefDTO {
    @Property() public path: string;
    /** The new blob SHA. */
    @Property() public sha: string;
}
