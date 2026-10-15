import { CommonUtils } from '@radoslavirha/utils';
import type { OllamaEmbedRequestDTO } from '../endpoints/ollama/dto/OllamaEmbedRequestDTO.js';
import { OllamaEmbedResponseDTO } from '../endpoints/ollama/dto/OllamaEmbedResponseDTO.js';
import { fakeVector } from './fakes.js';

/**
 * Stands in for `OllamaEndpoint` in the integration tests (`imports: [{ token, use }]`):
 * deterministic 4-dimension vectors from {@link fakeVector}, a switch to play an outage, and
 * every request kept for assertions.
 */
export class FakeOllamaEndpoint {
    public readonly requests: OllamaEmbedRequestDTO[] = [];
    public failing = false;
    public dimensions = 4;

    public embed(request: OllamaEmbedRequestDTO): Promise<OllamaEmbedResponseDTO> {
        this.requests.push(request);

        if (this.failing) {
            return Promise.reject(new Error('Ollama unreachable'));
        }

        return Promise.resolve(CommonUtils.buildModelStrict(OllamaEmbedResponseDTO, {
            model: request.model,
            embeddings: request.input.map((text) => [...fakeVector(text), ...new Array<number>(Math.max(0, this.dimensions - 4)).fill(0)]
                .slice(0, this.dimensions))
        }));
    }

    /** Texts sent as documents (not questions) so far. */
    public get embeddedDocuments(): string[] {
        return this.requests.flatMap((request) => request.input).filter((text) => !text.startsWith('task: search result'));
    }
}
