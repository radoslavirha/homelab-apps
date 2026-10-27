import { createHash } from 'node:crypto';
import pg from 'pg';

/**
 * The full-text vector of one chunk, in the KB's own text search configuration: title and
 * heading path weighted `A`, the body `B`. Written by the indexer rather than a generated
 * column, because the configuration differs per knowledge base.
 *
 * Every argument is an SQL expression (a parameter placeholder or a column).
 */
export const ftsExpression = (tsConfig: string, title: string, heading: string, body: string): string =>
    `setweight(to_tsvector(${tsConfig}, coalesce(${title}, '') || ' ' || ${heading}), 'A')` +
    ` || setweight(to_tsvector(${tsConfig}, ${body}), 'B')`;

/** pgvector's text input form, `[0.1,0.2,…]`. */
export const toVectorLiteral = (vector: readonly number[]): string => `[${vector.join(',')}]`;

/**
 * A model name as an SQL literal. Inlined rather than bound so the planner can match the
 * per-model partial HNSW index (`WHERE model = '…'`) — a parameter would not prove the match.
 * Model names come from configuration, and are escaped regardless.
 */
export const modelLiteral = (model: string): string => pg.escapeLiteral(model);

/**
 * Name of a model's HNSW index. Postgres truncates identifiers at 63 bytes, so the readable part
 * is cut short and a hash of the full name and dimension keeps two models from colliding.
 */
export const modelIndexName = (model: string, dimensions: number): string => {
    const digest = createHash('sha256').update(`${model}\u0000${dimensions}`).digest('hex').slice(0, 10);
    const readable = model.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28);

    return `embeddings_hnsw_${readable}_${digest}`;
};
