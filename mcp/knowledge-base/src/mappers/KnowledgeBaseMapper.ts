import { CommonUtils, MappingUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import type { DocumentResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentResponseDTO.js';
import type { SearchResponseDTO } from '../endpoints/knowledge-base-api/dto/SearchResponseDTO.js';
import type { SearchResultDTO } from '../endpoints/knowledge-base-api/dto/SearchResultDTO.js';
import { ReadOutput } from '../models/ReadOutput.js';
import { SearchHit } from '../models/SearchHit.js';
import { SearchOutput } from '../models/SearchOutput.js';

/** knowledge-base-api's answers to the tools' outputs. Read-only: nothing maps back. */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class KnowledgeBaseMapper extends MappingUtils {
    public toSearch(response: SearchResponseDTO): SearchOutput {
        return CommonUtils.buildModelStrict(SearchOutput, {
            hits: response.results.map((result) => this.toHit(result))
        });
    }

    public toRead(document: DocumentResponseDTO): ReadOutput {
        return CommonUtils.buildModelStrict(ReadOutput, {
            id: document.externalId,
            title: document.title,
            date: document.date,
            metadata: document.metadata,
            markdown: document.content
        });
    }

    private toHit(result: SearchResultDTO): SearchHit {
        return CommonUtils.buildModelStrict(SearchHit, {
            id: result.externalId,
            anchor: result.anchor,
            title: result.title,
            heading: result.heading,
            snippet: result.snippet,
            date: result.date
        });
    }
}
