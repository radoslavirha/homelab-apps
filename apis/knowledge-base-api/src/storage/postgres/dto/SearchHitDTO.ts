import { AdditionalProperties, Name, Nullable, Property } from '@tsed/schema';

/** One search result row, before fusion scores are attached. */
@AdditionalProperties(false)
export class SearchHitDTO {
    /** Chunk id, `bigint` as text. */
    @Property() public id: string;
    @Property() public kb: string;
    @Property() @Name('external_id') public externalId: string;
    @Property() public anchor: string;
    @Nullable(String) public title: string | null;
    @Property() public heading: string;
    @Property() public snippet: string;
    @Nullable(String) public date: string | null;
    @Nullable(String) public url: string | null;
    @Property(Object) public metadata: Record<string, unknown>;
    /** An abandoned spec, or a note another note supersedes: ranked last, never hidden. */
    @Property() public demoted: boolean;
}
