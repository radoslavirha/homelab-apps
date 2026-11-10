import z from 'zod';

export const IndexerConfigSchema = z.object({
    enabled: z.boolean().default(true).describe('Runs the background loop. POST /reindex works either way.'),
    intervalMs: z.number().int().min(10_000).default(300_000)
        .describe('Pause between the end of one run and the start of the next.'),
    initialDelayMs: z.number().int().nonnegative().default(5_000)
        .describe('Delay from startup to the first run of the background loop.'),
    fetchConcurrency: z.number().int().min(1).max(16).default(4)
        .describe('Source documents fetched in parallel.'),
    maxScheduledEmbeddings: z.number().int().nonnegative().default(300)
        .describe('Largest embedding backlog a scheduled run takes on, per model. A bigger one — a new model, a first build, a large import — waits for `POST /reindex`: a full embed saturates the Ollama node for ~25 minutes and evicts its chat model, so it is started by hand.')
}).prefault({});

export type IndexerConfig = z.infer<typeof IndexerConfigSchema>;
