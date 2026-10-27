import { AdditionalProperties, Property } from '@tsed/schema';

/** `GET /search` query parameters. */
@AdditionalProperties(false)
export class SearchQueryDTO {
    @Property() public q: string;
    @Property() public kb?: string;
    /** `key:value,…` on metadata. */
    @Property() public filter?: string;
    @Property() public limit?: number;
}
