import { CollectionOf, Description, Required } from '@tsed/schema';
import { KnowledgeBaseInfo } from './KnowledgeBaseInfo.js';

@Description('The knowledge bases this server can search.')
export class ListKnowledgeBasesOutput {
    @Required()
    @CollectionOf(KnowledgeBaseInfo)
    public knowledgeBases: KnowledgeBaseInfo[];
}
