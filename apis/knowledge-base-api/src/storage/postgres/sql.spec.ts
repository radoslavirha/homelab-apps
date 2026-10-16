import { describe, expect, it } from 'vitest';
import { ftsExpression, modelIndexName, modelLiteral, toVectorLiteral } from './sql.js';

describe('sql', () => {
    it('names a model\'s index within Postgres\'s 63 bytes, distinct per model and dimension', () => {
        const long = modelIndexName('a-very-long-model-name-from-some-registry/with:a-tag-1.5', 768);

        expect(long.length).toBeLessThanOrEqual(63);
        expect(modelIndexName('m:1', 768)).not.toBe(modelIndexName('m:1', 1024));
        expect(modelIndexName('embeddinggemma:300m', 768)).toMatch(/^embeddings_hnsw_embeddinggemma_300m_[0-9a-f]{10}$/);
    });

    it('escapes a model name as an SQL literal', () => {
        expect(modelLiteral("it's")).toBe("'it''s'");
    });

    it('writes a vector in pgvector\'s text form', () => {
        expect(toVectorLiteral([0.5, -1, 2])).toBe('[0.5,-1,2]');
    });

    it('weights title and heading A and the body B', () => {
        expect(ftsExpression('$1', 't', 'h', 'b')).toBe("setweight(to_tsvector($1, coalesce(t, '') || ' ' || h), 'A') || setweight(to_tsvector($1, b), 'B')");
    });
});
