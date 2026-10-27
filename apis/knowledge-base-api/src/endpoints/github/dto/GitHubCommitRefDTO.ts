import { AdditionalProperties, Property } from '@tsed/schema';

/** The commit a branch points at. */
@AdditionalProperties(false)
export class GitHubCommitRefDTO {
    @Property() public sha: string;
}
