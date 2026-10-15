import { AdditionalProperties, Property } from '@tsed/schema';

/** Documents of one knowledge base with one `metadata.area` value. */
@AdditionalProperties(false)
export class AreaCountDTO {
    /** Empty for documents without an area. */
    @Property() public area: string;
    @Property() public documents: number;
}
