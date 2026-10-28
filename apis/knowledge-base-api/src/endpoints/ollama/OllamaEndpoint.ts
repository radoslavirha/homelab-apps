import { Serializer } from '@radoslavirha/tsed-common';
import { InjectHttpClient, type HttpClient } from '@radoslavirha/tsed-http-provider';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
import { OllamaEmbedRequestDTO } from './dto/OllamaEmbedRequestDTO.js';
import { OllamaEmbedResponseDTO } from './dto/OllamaEmbedResponseDTO.js';

const EMBED_PATH = '/api/embed';

/**
 * Ollama's embed API. Base URL, timeouts, retries and the circuit breaker come from
 * `externalApis.OLLAMA` for indexing and `externalApis.OLLAMA_SEARCH` for a question at search
 * time; failures arrive already translated to 502/503/504.
 *
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class OllamaEndpoint {
    @InjectHttpClient(ExternalApi.Ollama)
    private readonly client!: HttpClient;

    @InjectHttpClient(ExternalApi.OllamaSearch)
    private readonly searchClient!: HttpClient;

    /** Embeds chunks for the index, under the indexing budget. */
    public embed(request: OllamaEmbedRequestDTO, signal?: AbortSignal): Promise<OllamaEmbedResponseDTO> {
        return OllamaEndpoint.post(this.client, request, signal);
    }

    /** Embeds a question for a search, under the search budget. */
    public embedQuestion(request: OllamaEmbedRequestDTO): Promise<OllamaEmbedResponseDTO> {
        return OllamaEndpoint.post(this.searchClient, request);
    }

    private static async post(client: HttpClient, request: OllamaEmbedRequestDTO, signal?: AbortSignal): Promise<OllamaEmbedResponseDTO> {
        const response = await client.post<object>(
            EMBED_PATH,
            Serializer.serialize(request, OllamaEmbedRequestDTO),
            // http-provider does not retry a POST by default; an embedding writes nothing, so a replay is harmless.
            { signal, retry: true }
        );

        return Serializer.deserialize(response, OllamaEmbedResponseDTO);
    }
}
