import z from 'zod';
import { FullTextMatch } from './FullTextMatch.enum.js';

export const SearchWeightsSchema = z.object({
    fullText: z.number().min(0).max(10).default(0)
        .describe('RRF weight of the full-text leg. At 0 it still runs, at weight 1, for chunks with no vector yet, and for knowledge bases with no model or when the vector leg is off.'),
    vector: z.number().min(0).max(10).default(1)
        .describe('RRF weight of the vector leg: each knowledge base\'s first model, or the model the request names. 0 drops the leg.')
});

export const SearchConfigSchema = z.object({
    defaultLimit: z.number().int().min(1).max(50).default(10)
        .describe('Results returned by `GET /search` when the request sets no `limit`.'),
    candidates: z.number().int().min(10).max(500).default(50)
        .describe('Hits taken from each leg (full-text, the vector model) before fusion.'),
    rrfK: z.number().int().min(1).default(60)
        .describe('Reciprocal rank fusion constant: score = Σ weight / (k + rank).'),
    weights: SearchWeightsSchema.prefault({})
        .describe('Per-leg RRF weights. The default is vector only: in the model measurement (16 real questions, embeddinggemma) vector alone scored MRR 0.86 and plain RRF with the full-text leg 0.79. Measure before raising `fullText` — `GET /search` takes per-request weights for exactly that.'),
    fullTextMatch: z.enum(FullTextMatch).default(FullTextMatch.Any)
        .describe('How question terms combine in the full-text leg.')
}).prefault({});

export type SearchWeights = z.infer<typeof SearchWeightsSchema>;
export type SearchConfig = z.infer<typeof SearchConfigSchema>;
