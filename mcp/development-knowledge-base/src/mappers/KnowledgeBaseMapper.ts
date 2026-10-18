import { CommonUtils, MappingUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import type { DocumentResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentResponseDTO.js';
import type { KnowledgeBaseStatusDTO } from '../endpoints/knowledge-base-api/dto/KnowledgeBaseStatusDTO.js';
import type { SearchResponseDTO } from '../endpoints/knowledge-base-api/dto/SearchResponseDTO.js';
import type { SearchResultDTO } from '../endpoints/knowledge-base-api/dto/SearchResultDTO.js';
import type { StatusResponseDTO } from '../endpoints/knowledge-base-api/dto/StatusResponseDTO.js';
import type { ConfigModel } from '../models/config/ConfigModel.js';
import { KnowledgeBaseInfo } from '../models/KnowledgeBaseInfo.js';
import { ListKnowledgeBasesOutput } from '../models/ListKnowledgeBasesOutput.js';
import { ReadOutput } from '../models/ReadOutput.js';
import { SearchHit } from '../models/SearchHit.js';
import { SearchOutput } from '../models/SearchOutput.js';

/** knowledge-base-api's answers to the tools' outputs. Read-only: nothing maps back. */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class KnowledgeBaseMapper extends MappingUtils {
    public toList(status: StatusResponseDTO, descriptions: ConfigModel['knowledgeBases']): ListKnowledgeBasesOutput {
        return CommonUtils.buildModelStrict(ListKnowledgeBasesOutput, {
            knowledgeBases: status.knowledgeBases.map((kb) => this.toInfo(kb, descriptions))
        });
    }

    public toSearch(response: SearchResponseDTO): SearchOutput {
        return CommonUtils.buildModelStrict(SearchOutput, {
            hits: response.results.map((result) => this.toHit(result))
        });
    }

    public toRead(document: DocumentResponseDTO): ReadOutput {
        return CommonUtils.buildModelStrict(ReadOutput, {
            kb: document.kb,
            id: document.externalId,
            title: document.title,
            date: document.date,
            metadata: document.metadata,
            markdown: document.content
        });
    }

    private toInfo(kb: KnowledgeBaseStatusDTO, descriptions: ConfigModel['knowledgeBases']): KnowledgeBaseInfo {
        const entry = descriptions[kb.id];

        return CommonUtils.buildModelStrict(KnowledgeBaseInfo, {
            id: kb.id,
            description: CommonUtils.isUndefined(entry) ? null : entry.description,
            documents: kb.documents,
            lastIndexedAt: kb.lastSuccessAt
        });
    }

    private toHit(result: SearchResultDTO): SearchHit {
        return CommonUtils.buildModelStrict(SearchHit, {
            kb: result.kb,
            id: result.externalId,
            anchor: result.anchor,
            title: result.title,
            heading: result.heading,
            snippet: result.snippet,
            date: result.date
        });
    }
}
