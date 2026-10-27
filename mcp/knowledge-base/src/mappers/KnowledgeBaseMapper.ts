import { CommonUtils, MappingUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { Conflict } from '@tsed/exceptions';
import type { DocumentDeleteResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentDeleteResponseDTO.js';
import { DocumentDeleteRequestDTO } from '../endpoints/knowledge-base-api/dto/DocumentDeleteRequestDTO.js';
import type { DocumentResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentResponseDTO.js';
import { DocumentWriteRequestDTO } from '../endpoints/knowledge-base-api/dto/DocumentWriteRequestDTO.js';
import type { DocumentWriteResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentWriteResponseDTO.js';
import { NoteCreateRequestDTO } from '../endpoints/knowledge-base-api/dto/NoteCreateRequestDTO.js';
import type { NoteCreateResponseDTO } from '../endpoints/knowledge-base-api/dto/NoteCreateResponseDTO.js';
import { NoteTypeDTO } from '../endpoints/knowledge-base-api/dto/NoteTypeDTO.enum.js';
import type { SearchResponseDTO } from '../endpoints/knowledge-base-api/dto/SearchResponseDTO.js';
import type { SearchResultDTO } from '../endpoints/knowledge-base-api/dto/SearchResultDTO.js';
import type { CreateNoteInput } from '../models/CreateNoteInput.js';
import { CreateNoteOutput } from '../models/CreateNoteOutput.js';
import { CurrentDocument } from '../models/CurrentDocument.js';
import type { DeleteDocumentInput } from '../models/DeleteDocumentInput.js';
import { DeleteDocumentOutput } from '../models/DeleteDocumentOutput.js';
import { NoteType } from '../models/NoteType.enum.js';
import { ReadOutput } from '../models/ReadOutput.js';
import { SearchHit } from '../models/SearchHit.js';
import { SearchOutput } from '../models/SearchOutput.js';
import type { WriteDocumentInput } from '../models/WriteDocumentInput.js';
import { WriteDocumentOutput } from '../models/WriteDocumentOutput.js';
import { WriteRefusal } from '../models/WriteRefusal.js';

/** platform-mcp's `code` for a tool that threw a `Conflict`; a refusal reads the same. */
const CONFLICT_CODE = 'E_MCP_TOOL_CONFLICT';

/**
 * Tool inputs to knowledge-base-api's requests, and its answers to the tools' outputs. The
 * knowledge base is the endpoint's, never the caller's: it comes in as `kb`.
 */
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
            version: document.version,
            markdown: document.content
        });
    }

    public toNoteCreateRequest(input: CreateNoteInput, kb: string): NoteCreateRequestDTO {
        return CommonUtils.buildModelStrict(NoteCreateRequestDTO, {
            kb,
            title: input.title,
            type: this.mapEnum({ NoteType }, { NoteTypeDTO }, input.type),
            context: input.context,
            decisionOrFact: input.decisionOrFact,
            alternativesRejected: input.alternativesRejected,
            howToApply: input.howToApply,
            links: input.links,
            repos: input.repos,
            date: input.date,
            supersedes: input.supersedes
        });
    }

    public toCreateNote(response: NoteCreateResponseDTO): CreateNoteOutput {
        return CommonUtils.buildModelStrict(CreateNoteOutput, { id: response.id, version: response.version, commit: response.commit });
    }

    public toDocumentWriteRequest(input: WriteDocumentInput, kb: string): DocumentWriteRequestDTO {
        return CommonUtils.buildModelStrict(DocumentWriteRequestDTO, {
            kb,
            id: input.id,
            content: input.content,
            version: input.version,
            message: input.message
        });
    }

    public toWriteDocument(response: DocumentWriteResponseDTO): WriteDocumentOutput {
        return CommonUtils.buildModelStrict(WriteDocumentOutput, { id: response.id, version: response.version, commit: response.commit });
    }

    public toDocumentDeleteRequest(input: DeleteDocumentInput, kb: string): DocumentDeleteRequestDTO {
        return CommonUtils.buildModelStrict(DocumentDeleteRequestDTO, { kb, id: input.id, version: input.version, reason: input.reason });
    }

    public toDeleteDocument(response: DocumentDeleteResponseDTO): DeleteDocumentOutput {
        return CommonUtils.buildModelStrict(DeleteDocumentOutput, { id: response.id, commit: response.commit });
    }

    /** A refused write's message, and the document as it is now, which the caller applies its change to. */
    public toRefusal(message: string, content: string, version: string): WriteRefusal {
        return CommonUtils.buildModelStrict(WriteRefusal, {
            statusCode: Conflict.STATUS,
            code: CONFLICT_CODE,
            message,
            current: CommonUtils.buildModelStrict(CurrentDocument, { content, version })
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
