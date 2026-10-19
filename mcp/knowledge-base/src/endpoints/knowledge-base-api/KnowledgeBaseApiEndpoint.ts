import { Serializer } from '@radoslavirha/tsed-common';
import { InjectHttpClient, type HttpClient } from '@radoslavirha/tsed-http-provider';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
import { DocumentQueryDTO } from './dto/DocumentQueryDTO.js';
import { DocumentResponseDTO } from './dto/DocumentResponseDTO.js';
import { SearchQueryDTO } from './dto/SearchQueryDTO.js';
import { SearchResponseDTO } from './dto/SearchResponseDTO.js';
import { StatusResponseDTO } from './dto/StatusResponseDTO.js';

const SEARCH_PATH = '/search';
const DOCUMENTS_PATH = '/documents';
const STATUS_PATH = '/status';

/**
 * knowledge-base-api's read routes. Base URL, auth, timeouts, retries and the circuit breaker come
 * from `externalApis.KNOWLEDGE_BASE_API`.
 *
 * Auth is http-provider's `token-exchange`: a `client_credentials` token for `development-kb-mcp`,
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

    /** The knowledge bases this server's client may read, with their counts and last build. */
    public async status(): Promise<StatusResponseDTO> {
        const response = await this.client.get<object>(STATUS_PATH);

        return Serializer.deserialize(response, StatusResponseDTO);
    }

    public async search(query: SearchQueryDTO): Promise<SearchResponseDTO> {
        const response = await this.client.get<object>(SEARCH_PATH, { params: KnowledgeBaseApiEndpoint.params(query, SearchQueryDTO) });

        return Serializer.deserialize(response, SearchResponseDTO);
    }

    public async document(query: DocumentQueryDTO): Promise<DocumentResponseDTO> {
        const response = await this.client.get<object>(DOCUMENTS_PATH, { params: KnowledgeBaseApiEndpoint.params(query, DocumentQueryDTO) });

        return Serializer.deserialize(response, DocumentResponseDTO);
    }

    /** A query DTO as query-string parameters; an unset optional field is left out. */
    private static params<T extends object>(query: T, type: new () => T): Record<string, unknown> {
        return Serializer.serialize(query, type) as Record<string, unknown>;
    }
}
