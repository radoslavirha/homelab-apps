import z from 'zod';

/**
 * The most hits `GET /search` returns (its `limit` is 1–50). This server's own constant, not
 * imported from knowledge-base-api: the two apps share no code.
 */
export const API_MAX_SEARCH_LIMIT = 50;

/**
 * Per-leg RRF weights sent with every search, overriding the API's configured ones; 0 drops a
 * leg. The defaults match the API's own (vector only) but are this server's constants.
 */
export const McpSearchWeightsSchema = z.object({
    vector: z.number().min(0).max(10).default(1)
        .describe('RRF weight of the vector leg (0–10).'),
    fullText: z.number().min(0).max(10).default(0)
        .describe('RRF weight of the full-text leg (0–10).')
})
    .refine((weights) => weights.vector > 0 || weights.fullText > 0, 'At least one weight must be above 0: with both at 0 a search finds nothing.');

/**
 * How one endpoint searches its knowledge base. Config only — never a `search` tool argument —
 * so a model or a blend can be tried by editing config and restarting, without a release.
 */
export const McpSearchConfigSchema = z.object({
    defaultLimit: z.number().int().min(1).max(API_MAX_SEARCH_LIMIT).default(8)
        .describe('Hits returned when the agent gives no `limit`.'),
    maxLimit: z.number().int().min(1).max(API_MAX_SEARCH_LIMIT).default(API_MAX_SEARCH_LIMIT)
        .describe(`The most hits an agent gets: a larger \`limit\` is lowered to this. At most ${API_MAX_SEARCH_LIMIT}, the API's own cap.`),
    model: z.string().min(1).optional()
        .describe('Embedding model that answers the vector leg. Unset: the knowledge base\'s first configured model.'),
    weights: McpSearchWeightsSchema.prefault({})
        .describe('RRF weights, always sent: they override the API\'s configured weights.')
})
    .refine((search) => search.defaultLimit <= search.maxLimit, { path: ['defaultLimit'], message: 'defaultLimit must not exceed maxLimit.' });

export type McpSearchConfig = z.infer<typeof McpSearchConfigSchema>;

/** The settings of an endpoint whose config has no `search` block. */
export const DEFAULT_SEARCH_CONFIG: McpSearchConfig = McpSearchConfigSchema.parse({});
