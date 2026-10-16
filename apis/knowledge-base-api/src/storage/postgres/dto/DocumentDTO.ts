import { AdditionalProperties, Name, Nullable, Property } from '@tsed/schema';

/** A `documents` row, as written and as read back. */
@AdditionalProperties(false)
export class DocumentDTO {
    @Property() public kb: string;
    @Property() @Name('external_id') public externalId: string;
    @Nullable(String) public title: string | null;
    /** `YYYY-MM-DD` — read as `date::text`, so no time zone shifts it. */
    @Nullable(String) public date: string | null;
    @Nullable(String) public url: string | null;
    @Property() public content: string;
    @Property() public version: string;
    @Property(Object) public metadata: Record<string, unknown>;
}
