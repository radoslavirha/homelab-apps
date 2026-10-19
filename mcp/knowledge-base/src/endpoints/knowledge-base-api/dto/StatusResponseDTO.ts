import { AdditionalProperties, CollectionOf } from '@tsed/schema';
import { KnowledgeBaseStatusDTO } from './KnowledgeBaseStatusDTO.js';

/** `GET /status` response: the knowledge bases the caller may read. */
@AdditionalProperties(false)
export class StatusResponseDTO {
    @CollectionOf(KnowledgeBaseStatusDTO) public knowledgeBases: KnowledgeBaseStatusDTO[];
}
