import z from 'zod';

/** Placeholders a document template may use. */
export const TEMPLATE_TITLE = '{title}';
export const TEMPLATE_TEXT = '{text}';
/** The placeholder a query template must use. */
export const TEMPLATE_QUERY = '{query}';

export const EmbeddingModelSchema = z.object({
    name: z.string().min(1).describe('Ollama model tag, e.g. `embeddinggemma:300m`. Stored in `embeddings.model`.'),
    dimensions: z.number().int().positive().max(2000)
        .describe('Vector length the model returns. It becomes the cast in this model\'s HNSW index, so a mismatch fails the first insert instead of silently mixing lengths. pgvector indexes `vector` up to 2000 dimensions.'),
    documentTemplate: z.string().includes(TEMPLATE_TEXT).default(TEMPLATE_TEXT)
        .describe('What a chunk is sent as; must contain `{text}`. `{title}` is the document title (`none` when it has none, as the embeddinggemma model card prescribes); `{text}` is the heading path, a blank line and the body. Task prefixes are part of the model contract — embeddinggemma scores worse without them. Changing a template changes every vector: give the model a new entry instead.'),
    queryTemplate: z.string().includes(TEMPLATE_QUERY).default(TEMPLATE_QUERY)
        .describe('What a question is sent as; must contain `{query}`, the question. See `documentTemplate`.')
});

export const EmbeddingsConfigSchema = z.object({
    models: z.array(EmbeddingModelSchema).default([])
        .describe('Embedding models a knowledge base may name in its `models`. Names must be unique. Empty: every knowledge base is full-text only.'),
    batchSize: z.number().int().positive().max(256).default(16)
        .describe('Chunks per Ollama embed call.'),
    keepAlive: z.string().default('1m')
        .describe('Ollama keep_alive: long enough that a run does not reload the model per batch, short enough that a chat model on the same node gets its memory back.')
}).prefault({});

export type EmbeddingModelConfig = z.infer<typeof EmbeddingModelSchema>;
export type EmbeddingsConfig = z.infer<typeof EmbeddingsConfigSchema>;
