import { Serializer } from '@radoslavirha/tsed-common';
import { InjectHttpClient, type HttpClient } from '@radoslavirha/tsed-http-provider';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
import { OllamaEmbedRequestDTO } from './dto/OllamaEmbedRequestDTO.js';
import { OllamaEmbedResponseDTO } from './dto/OllamaEmbedResponseDTO.js';

const EMBED_PATH = '/api/embed';

/**
 * Ollama's embed API. Base URL, timeouts, retries and the circuit breaker come from
 * `externalApis.OLLAMA`; failures arrive already translated to 502/503/504.
 *
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class OllamaEndpoint {
    @InjectHttpClient(ExternalApi.Ollama)
    private readonly client!: HttpClient;

    public async embed(request: OllamaEmbedRequestDTO, signal?: AbortSignal): Promise<OllamaEmbedResponseDTO> {
        const response = await this.client.post<object>(
            EMBED_PATH,
            Serializer.serialize(request, OllamaEmbedRequestDTO),
            { signal }
        );

        return Serializer.deserialize(response, OllamaEmbedResponseDTO);
    }
}
