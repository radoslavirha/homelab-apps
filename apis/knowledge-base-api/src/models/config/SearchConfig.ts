import z from 'zod';
import { FullTextMatch } from './FullTextMatch.enum.js';

export const SearchWeightsSchema = z.object({
    fullText: z.number().min(0).max(10).default(0),
    vector: z.number().min(0).max(10).default(1)
});

export const SearchConfigSchema = z.object({
    defaultLimit: z.number().int().min(1).max(50).default(10),
    candidates: z.number().int().min(10).max(500).default(50)
        .describe('Hits taken from each leg (full-text, the vector model) before fusion.'),
    rrfK: z.number().int().min(1).default(60)
        .describe('Reciprocal rank fusion constant: score = Σ weight / (k + rank).'),
    /**
     * Per-leg RRF weights; 0 drops a leg. The default is vector only: in the model measurement
     * (16 real questions, embeddinggemma) vector alone scored MRR 0.86 and plain RRF with the
     * full-text leg 0.79. Full-text still answers when the vector leg cannot. Measure before
     * raising `fullText` — `GET /search` takes per-request weights for exactly that.
     */
    weights: SearchWeightsSchema.prefault({}),
    fullTextMatch: z.enum(FullTextMatch).default(FullTextMatch.Any)
        .describe('How question terms combine in the full-text leg.')
}).prefault({});

export type SearchWeights = z.infer<typeof SearchWeightsSchema>;
export type SearchConfig = z.infer<typeof SearchConfigSchema>;
