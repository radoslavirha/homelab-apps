import { AdditionalProperties, CollectionOf, Property } from '@tsed/schema';
import { SearchResultDTO } from './SearchResultDTO.js';

/** `GET /search` response. */
@AdditionalProperties(false)
export class SearchResponseDTO {
    /** `VECTOR`, `HYBRID` or `FULLTEXT`: how the API answered. */
    @Property() public mode: string;
    @CollectionOf(String) public models: string[];
    @CollectionOf(SearchResultDTO) public results: SearchResultDTO[];
}
