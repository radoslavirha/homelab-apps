import { ArrayUtils, CommonUtils, StringUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { BadGateway } from '@tsed/exceptions';
import { OllamaEmbedRequestDTO } from '../endpoints/ollama/dto/OllamaEmbedRequestDTO.js';
import type { OllamaEmbedResponseDTO } from '../endpoints/ollama/dto/OllamaEmbedResponseDTO.js';
import { OllamaEndpoint } from '../endpoints/ollama/OllamaEndpoint.js';
import type { EmbeddingModelConfig } from '../models/config/EmbeddingsConfig.js';
import { ConfigService } from './ConfigService.js';
import { MarkdownChunkerService } from './MarkdownChunkerService.js';

/** What `{title}` becomes for a document without one — the embeddinggemma model card's choice. */
export const MISSING_TITLE = 'none';

export interface EmbeddableChunk {
    readonly title: string | null;
    readonly heading: string;
    readonly body: string;
}

/**
 * Turns chunks and questions into vectors through Ollama, wrapping each in its model's template.
 *
 * Indexing and search both come through here, so a chunk and the question looking for it are
 * always shaped for the same model in the same way — the reason one service owns both.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class EmbeddingService {
    public constructor(
        private readonly ollama: OllamaEndpoint,
        private readonly configService: ConfigService
    ) {}

    public model(name: string): EmbeddingModelConfig | undefined {
        return this.configService.config.embeddings.models.find((model) => model.name === name);
    }

    /** The exact text a chunk is embedded as under `model`. */
    public static documentInput(model: EmbeddingModelConfig, chunk: EmbeddableChunk): string {
        const values: Record<string, string> = {
            title: StringUtils.isNotEmpty(chunk.title) ? chunk.title : MISSING_TITLE,
            text: MarkdownChunkerService.documentText(chunk.heading, chunk.body)
        };

        // One pass, so a title that happens to contain `{text}` is not expanded again.
        return model.documentTemplate.replace(/\{(title|text)\}/g, (_match, name: string) => values[name]);
    }

    /** The exact text a question is embedded as under `model`. */
    public static queryInput(model: EmbeddingModelConfig, question: string): string {
        return model.queryTemplate.replace(/\{query\}/g, () => question);
    }

    /** Under the indexing budget (`externalApis.OLLAMA`). */
    public embedDocuments(model: EmbeddingModelConfig, chunks: readonly EmbeddableChunk[]): Promise<number[][]> {
        return this.embed(model, chunks.map((chunk) => EmbeddingService.documentInput(model, chunk)), (request) => this.ollama.embed(request));
    }

    /** Under the search budget (`externalApis.OLLAMA_SEARCH`), so a slow embedder fails fast to full-text. */
    public async embedQuery(model: EmbeddingModelConfig, question: string): Promise<number[]> {
        const [vector] = await this.embed(model, [EmbeddingService.queryInput(model, question)], (request) => this.ollama.embedQuestion(request));

        return vector;
    }

    private async embed(
        model: EmbeddingModelConfig,
        input: string[],
        send: (request: OllamaEmbedRequestDTO) => Promise<OllamaEmbedResponseDTO>
    ): Promise<number[][]> {
        const response = await send(CommonUtils.buildModelStrict(OllamaEmbedRequestDTO, {
            model: model.name,
            input,
            keepAlive: this.configService.config.embeddings.keepAlive,
            truncate: true
        }));
        const vectors = ArrayUtils.toArray(response.embeddings);

        if (vectors.length !== input.length) {
            throw new BadGateway(`Ollama returned ${vectors.length} vectors for ${input.length} inputs.`);
        }

        const wrong = vectors.find((vector) => vector.length !== model.dimensions);

        if (CommonUtils.notUndefined(wrong)) {
            // A config error, not a transient one: say what to change.
            throw new BadGateway(
                `Model ${model.name} returned ${wrong.length} dimensions; embeddings.models declares ${model.dimensions}.`
            );
        }

        return vectors;
    }
}
