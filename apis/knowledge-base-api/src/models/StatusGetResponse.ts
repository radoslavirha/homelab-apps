import { AdditionalProperties, CollectionOf, Description, Required } from '@tsed/schema';
import { IndexerStatus } from './IndexerStatus.js';
import { KnowledgeBaseStatus } from './KnowledgeBaseStatus.js';

@Description('Index state of every knowledge base the caller may read.')
@AdditionalProperties(false)
export class StatusGetResponse {
    @Required()
    public indexer: IndexerStatus;

    @Required()
    @CollectionOf(KnowledgeBaseStatus)
    public knowledgeBases: KnowledgeBaseStatus[];
}
