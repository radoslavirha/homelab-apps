import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RankFusionService } from './RankFusionService.js';

const K = 60;

describe('RankFusionService', () => {
    let fusion: RankFusionService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        fusion = PlatformTest.get<RankFusionService>(RankFusionService);
    });
    afterEach(PlatformTest.reset);

    it('scores Σ weight / (k + rank) with 1-based ranks', () => {
        const [top] = fusion.fuse([{ ids: ['a', 'b'], weight: 1 }, { ids: ['a'], weight: 1 }], K);

        expect(top).toEqual({ id: 'a', score: 2 / 61 });
    });

    it('ranks an id found by both legs above one that tops only one leg', () => {
        const fused = fusion.fuse([
            { ids: ['x', 'both'], weight: 1 },
            { ids: ['y', 'both'], weight: 1 }
        ], K);

        expect(fused[0].id).toBe('both');
    });

    it('applies per-leg weights', () => {
        const fused = fusion.fuse([
            { ids: ['fulltext-top'], weight: 0.5 },
            { ids: ['vector-top'], weight: 1 }
        ], K);

        expect(fused.map((hit) => hit.id)).toEqual(['vector-top', 'fulltext-top']);
        expect(fused[1].score).toBeCloseTo(0.5 / 61);
    });

    it('ignores a leg with weight 0', () => {
        expect(fusion.fuse([{ ids: ['a'], weight: 0 }, { ids: ['b'], weight: 1 }], K).map((hit) => hit.id)).toEqual(['b']);
    });

    it('counts an id listed twice in one leg once, at its better rank', () => {
        const [hit] = fusion.fuse([{ ids: ['a', 'a'], weight: 1 }], K);

        expect(hit.score).toBe(1 / 61);
    });

    it('breaks score ties by best rank, then by first appearance', () => {
        // c and d each have ranks 1 and 2: equal scores, equal best rank — c was seen first.
        const tie = fusion.fuse([{ ids: ['c', 'd'], weight: 1 }, { ids: ['d', 'c'], weight: 1 }], K);

        expect(tie.map((hit) => hit.id)).toEqual(['c', 'd']);
    });

    it('returns nothing for no rankings', () => {
        expect(fusion.fuse([], K)).toEqual([]);
    });
});
