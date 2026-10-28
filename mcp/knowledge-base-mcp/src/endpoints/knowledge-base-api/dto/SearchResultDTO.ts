import { AdditionalProperties, Nullable, Property } from '@tsed/schema';

/** One hit of `GET /search`: a section of a document. */
@AdditionalProperties(false)
export class SearchResultDTO {
    @Property() public kb: string;
    @Property() public externalId: string;
    @Property() public anchor: string;
    @Nullable(String) public title: string | null;
    @Property() public heading: string;
    @Property() public snippet: string;
    @Property() public score: number;
    @Nullable(String) public date: string | null;
    @Nullable(String) public url: string | null;
    @Property(Object) public metadata: Record<string, unknown>;
}
