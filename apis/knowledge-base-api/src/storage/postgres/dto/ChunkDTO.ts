import { AdditionalProperties, Property } from '@tsed/schema';

/** A `chunks` row as the indexer writes it; `fts` is computed in SQL. */
@AdditionalProperties(false)
export class ChunkDTO {
    @Property() public ord: number;
    @Property() public heading: string;
    @Property() public anchor: string;
    @Property() public body: string;
    @Property() public hash: string;
}
