import { AdditionalProperties, CollectionOf, Enum } from '@tsed/schema';
import { GitHubCompareFileDTO } from './GitHubCompareFileDTO.js';
import { GitHubCompareStatusDTO } from './GitHubCompareStatusDTO.enum.js';

/** `GET /repos/{owner}/{repo}/compare/{base}...{head}`, first page. */
@AdditionalProperties(false)
export class GitHubCompareDTO {
    @Enum(GitHubCompareStatusDTO) public status: GitHubCompareStatusDTO;
    /** At most 300 for the whole comparison: GitHub lists no more. */
    @CollectionOf(GitHubCompareFileDTO) public files: GitHubCompareFileDTO[] = [];
}
