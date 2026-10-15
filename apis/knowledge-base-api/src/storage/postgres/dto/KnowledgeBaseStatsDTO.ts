import { AdditionalProperties, CollectionOf, Property } from '@tsed/schema';
import { AreaCountDTO } from './AreaCountDTO.js';
import { ModelCountDTO } from './ModelCountDTO.js';

/** What `/status` counts for one knowledge base. */
@AdditionalProperties(false)
export class KnowledgeBaseStatsDTO {
    @Property() public documents: number;
    @Property() public chunks: number;
    @CollectionOf(AreaCountDTO) public areas: AreaCountDTO[];
    @CollectionOf(ModelCountDTO) public embedded: ModelCountDTO[];
}
