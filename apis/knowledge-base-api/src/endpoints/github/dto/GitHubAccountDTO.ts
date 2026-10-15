import { AdditionalProperties, Property } from '@tsed/schema';

/** A GitHub user or organisation, as far as a repository's `owner` goes. */
@AdditionalProperties(false)
export class GitHubAccountDTO {
    @Property() public login: string;
}
