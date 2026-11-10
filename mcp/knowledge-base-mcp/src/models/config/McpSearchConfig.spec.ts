import { describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH_CONFIG, McpSearchConfigSchema } from './McpSearchConfig.js';

describe('McpSearchConfigSchema', () => {
    it('defaults every setting: 8 hits, at most 50 (the API\'s cap), the knowledge base\'s first model, vector only', () => {
        expect(McpSearchConfigSchema.parse({})).toEqual({ defaultLimit: 8, maxLimit: 50, weights: { vector: 1, fullText: 0 } });
        expect(DEFAULT_SEARCH_CONFIG).toEqual({ defaultLimit: 8, maxLimit: 50, weights: { vector: 1, fullText: 0 } });
    });

    it('defaults the weight a partial `weights` leaves out', () => {
        expect(McpSearchConfigSchema.parse({ weights: { fullText: 0.5 } }).weights).toEqual({ vector: 1, fullText: 0.5 });
    });

    it('accepts a full block', () => {
        const search = { defaultLimit: 10, maxLimit: 50, model: 'qwen3-embedding:0.6b', weights: { vector: 1, fullText: 0.3 } };

        expect(McpSearchConfigSchema.parse(search)).toEqual(search);
    });

    it('accepts a default limit equal to the max', () => {
        expect(McpSearchConfigSchema.safeParse({ defaultLimit: 20, maxLimit: 20 }).success).toBe(true);
    });

    it('refuses a default limit above the max, naming `defaultLimit`', () => {
        const result = McpSearchConfigSchema.safeParse({ defaultLimit: 30, maxLimit: 20 });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: ['defaultLimit'], message: 'defaultLimit must not exceed maxLimit.' });
    });

    it.each([
        ['maxLimit above the API\'s cap of 50', { maxLimit: 51 }],
        ['maxLimit below 1', { maxLimit: 0 }],
        ['a fractional defaultLimit', { defaultLimit: 2.5 }],
        ['an empty model', { model: '' }],
        ['a negative weight', { weights: { vector: -1 } }],
        ['a weight above 10', { weights: { fullText: 11 } }]
    ])('refuses %s', (_, search) => {
        expect(McpSearchConfigSchema.safeParse(search).success).toBe(false);
    });

    it('refuses both weights at 0, since such a search finds nothing', () => {
        const result = McpSearchConfigSchema.safeParse({ weights: { vector: 0, fullText: 0 } });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: ['weights'], message: 'At least one weight must be above 0: with both at 0 a search finds nothing.' });
    });
});
