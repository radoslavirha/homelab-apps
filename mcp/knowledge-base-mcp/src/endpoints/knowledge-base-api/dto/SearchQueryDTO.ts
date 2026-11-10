import { AdditionalProperties, Property } from '@tsed/schema';

/** `GET /search` query parameters. */
@AdditionalProperties(false)
export class SearchQueryDTO {
    @Property() public q: string;
    @Property() public kb?: string;
    /** `key:value,…` on metadata. */
    @Property() public filter?: string;
    @Property() public limit?: number;
    /** Embedding model for the vector leg; unset, the knowledge base's first. */
    @Property() public model?: string;
    /** RRF weight of the full-text leg, over the API's configured one. */
    @Property() public fullTextWeight?: number;
    /** RRF weight of the vector leg, over the API's configured one. */
    @Property() public vectorWeight?: number;
}
