import { Serializer } from '@radoslavirha/tsed-common';
import { InjectHttpClient, type HttpClient } from '@radoslavirha/tsed-http-provider';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
import { DocumentDeleteRequestDTO } from './dto/DocumentDeleteRequestDTO.js';
import { DocumentDeleteResponseDTO } from './dto/DocumentDeleteResponseDTO.js';
import { DocumentQueryDTO } from './dto/DocumentQueryDTO.js';
import { DocumentResponseDTO } from './dto/DocumentResponseDTO.js';
import { DocumentWriteRequestDTO } from './dto/DocumentWriteRequestDTO.js';
import { DocumentWriteResponseDTO } from './dto/DocumentWriteResponseDTO.js';
import { NoteCreateRequestDTO } from './dto/NoteCreateRequestDTO.js';
import { NoteCreateResponseDTO } from './dto/NoteCreateResponseDTO.js';
import { SearchQueryDTO } from './dto/SearchQueryDTO.js';
import { SearchResponseDTO } from './dto/SearchResponseDTO.js';

const SEARCH_PATH = '/search';
const DOCUMENTS_PATH = '/documents';
const NOTES_PATH = '/notes';

/** Names the person a write is for; the API puts it in the commit. The caller is this server. */
const ON_BEHALF_OF_HEADER = 'On-Behalf-Of';

/**
 * knowledge-base-api's routes. Base URL, auth, timeouts, retries and the circuit breaker come
 * from `externalApis.KNOWLEDGE_BASE_API`.
 *
 * Auth is http-provider's `token-exchange`: a `client_credentials` token for `knowledge-base-mcp`,
 * cached until the API answers `401`, then fetched again and the call retried once. With
 * 10-minute tokens that is one refused call per token lifetime, and no refresh code here.
 *
 * @see https://github.com/radoslavirha/homelab-apps/blob/main/apis/knowledge-base-api/README.md
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class KnowledgeBaseApiEndpoint {
    @InjectHttpClient(ExternalApi.KnowledgeBaseApi)
    private readonly client!: HttpClient;

    public async search(query: SearchQueryDTO): Promise<SearchResponseDTO> {
        const response = await this.client.get<object>(SEARCH_PATH, { params: KnowledgeBaseApiEndpoint.params(query, SearchQueryDTO) });

        return Serializer.deserialize(response, SearchResponseDTO);
    }

    public async document(query: DocumentQueryDTO): Promise<DocumentResponseDTO> {
        const response = await this.client.get<object>(DOCUMENTS_PATH, { params: KnowledgeBaseApiEndpoint.params(query, DocumentQueryDTO) });

        return Serializer.deserialize(response, DocumentResponseDTO);
    }

    /** A write is one commit. A refusal (`409`) carries the current document in its error body. */
    public async createNote(request: NoteCreateRequestDTO, onBehalfOf: string): Promise<NoteCreateResponseDTO> {
        const response = await this.client.post<object>(NOTES_PATH, Serializer.serialize(request, NoteCreateRequestDTO), KnowledgeBaseApiEndpoint.onBehalfOf(onBehalfOf));

        return Serializer.deserialize(response, NoteCreateResponseDTO);
    }

    public async writeDocument(request: DocumentWriteRequestDTO, onBehalfOf: string): Promise<DocumentWriteResponseDTO> {
        const response = await this.client.put<object>(DOCUMENTS_PATH, Serializer.serialize(request, DocumentWriteRequestDTO), KnowledgeBaseApiEndpoint.onBehalfOf(onBehalfOf));

        return Serializer.deserialize(response, DocumentWriteResponseDTO);
    }

    public async deleteDocument(request: DocumentDeleteRequestDTO, onBehalfOf: string): Promise<DocumentDeleteResponseDTO> {
        // `delete` takes no body; the API's DELETE does.
        const response = await this.client.request<object>({
            method: 'DELETE',
            url: DOCUMENTS_PATH,
            body: Serializer.serialize(request, DocumentDeleteRequestDTO),
            ...KnowledgeBaseApiEndpoint.onBehalfOf(onBehalfOf)
        });

        return Serializer.deserialize(response, DocumentDeleteResponseDTO);
    }

    private static onBehalfOf(username: string): { headers: Record<string, string> } {
        return { headers: { [ON_BEHALF_OF_HEADER]: username } };
    }

    /** A query DTO as query-string parameters; an unset optional field is left out. */
    private static params<T extends object>(query: T, type: new () => T): Record<string, unknown> {
        return Serializer.serialize(query, type) as Record<string, unknown>;
    }
}
