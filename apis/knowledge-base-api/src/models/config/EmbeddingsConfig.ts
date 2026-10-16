import z from 'zod';

/** Placeholders a document template may use. */
export const TEMPLATE_TITLE = '{title}';
export const TEMPLATE_TEXT = '{text}';
/** The placeholder a query template must use. */
export const TEMPLATE_QUERY = '{query}';

export const EmbeddingModelSchema = z.object({
    name: z.string().min(1).describe('Ollama model tag, e.g. `embeddinggemma:300m`. Stored in `embeddings.model`.'),
    /**
     * Vector length the model returns. It becomes the cast in this model's HNSW index, so a
     * mismatch fails the first insert instead of silently mixing lengths. pgvector indexes
     * `vector` up to 2000 dimensions.
     */
    dimensions: z.number().int().positive().max(2000),
    /**
     * What a chunk is sent as. `{title}` is the document title (`none` when it has none, as the
     * embeddinggemma model card prescribes); `{text}` is the heading path, a blank line and the
     * body. Task prefixes are part of the model contract — embeddinggemma scores worse without
     * them. Changing a template changes every vector: give the model a new entry instead.
     */
    documentTemplate: z.string().includes(TEMPLATE_TEXT).default(TEMPLATE_TEXT),
    /** What a question is sent as; `{query}` is the question. See `documentTemplate`. */
    queryTemplate: z.string().includes(TEMPLATE_QUERY).default(TEMPLATE_QUERY)
});

export const EmbeddingsConfigSchema = z.object({
    models: z.array(EmbeddingModelSchema).default([]),
    batchSize: z.number().int().positive().max(256).default(16)
        .describe('Chunks per Ollama embed call.'),
    keepAlive: z.string().default('1m')
        .describe('Ollama keep_alive: long enough that a run does not reload the model per batch, short enough that a chat model on the same node gets its memory back.')
}).prefault({});

export type EmbeddingModelConfig = z.infer<typeof EmbeddingModelSchema>;
export type EmbeddingsConfig = z.infer<typeof EmbeddingsConfigSchema>;
