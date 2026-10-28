import { AdditionalProperties, Property } from '@tsed/schema';

/** `DELETE /documents` body. */
@AdditionalProperties(false)
export class DocumentDeleteRequestDTO {
    @Property() public kb: string;
    @Property() public id: string;
    @Property() public version: string;
    /** Kept in the commit message. */
    @Property() public reason: string;
}
