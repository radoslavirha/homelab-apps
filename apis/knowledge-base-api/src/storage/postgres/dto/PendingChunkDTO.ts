import { AdditionalProperties, Nullable, Property } from '@tsed/schema';

/** A chunk with no vector for some model yet, with what its model template needs. */
@AdditionalProperties(false)
export class PendingChunkDTO {
    /** `bigint`, as text. */
    @Property() public id: string;
    @Nullable(String) public title: string | null;
    @Property() public heading: string;
    @Property() public body: string;
}
