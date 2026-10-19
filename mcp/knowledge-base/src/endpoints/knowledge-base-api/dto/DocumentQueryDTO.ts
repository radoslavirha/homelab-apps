import { AdditionalProperties, Property } from '@tsed/schema';

/** `GET /documents` query parameters. */
@AdditionalProperties(false)
export class DocumentQueryDTO {
    /** An `externalId`, or a search result's `anchor`. */
    @Property() public id: string;
    @Property() public kb?: string;
}
