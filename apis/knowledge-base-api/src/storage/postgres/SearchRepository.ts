import { Serializer } from '@radoslavirha/tsed-common';
import { CommonUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { FullTextMatch } from '../../models/config/FullTextMatch.enum.js';
import type { EmbeddingModelConfig } from '../../models/config/EmbeddingsConfig.js';
import type { MetadataFilter } from '../../models/MetadataFilter.js';
import { SearchHitDTO } from './dto/SearchHitDTO.js';
import { PostgresService } from './PostgresService.js';
import { modelLiteral, toVectorLiteral } from './sql.js';

/** pgvector's ceiling for `hnsw.ef_search`. */
const MAX_EF_SEARCH = 1000;

/**
 * The question as a `tsquery`, built per KB in that KB's text search configuration. `$2` is
 * the question.
 *
 * `ANY` ORs the question's own lexemes — stemmed and stop-word-free, because `to_tsvector`
 * already did that — and quotes each one, so nothing in the question is read as operator syntax.
 */
const tsQuery = (match: FullTextMatch): string => match === FullTextMatch.All
    ? 'websearch_to_tsquery(k.ts_config, $2)'
    : `(SELECT string_agg(quote_literal(lexeme), ' | ')
        FROM unnest(tsvector_to_array(to_tsvector(k.ts_config, $2))) AS lexeme)::tsquery`;

/**
 * `AND (…)` clauses for a metadata filter, numbered from `firstIndex`. A value matches a scalar
 * field equal to it or an array field containing it.
 */
export const metadataFilterSql = (filter: MetadataFilter, firstIndex: number): { sql: string; values: string[] } => {
    const values: string[] = [];
    const clauses: string[] = [];

    for (const [key, accepted] of filter) {
        const alternatives = accepted.flatMap((value) => {
            values.push(JSON.stringify({ [key]: value }), JSON.stringify({ [key]: [value] }));

            const scalar = firstIndex + values.length - 2;

            return [`d.metadata @> $${scalar}::jsonb`, `d.metadata @> $${scalar + 1}::jsonb`];
        });

        clauses.push(` AND (${alternatives.join(' OR ')})`);
    }

    return { sql: clauses.join(''), values };
};

@Service()
@Scope(ProviderScope.SINGLETON)
export class SearchRepository {
    public constructor(private readonly postgres: PostgresService) {}

    /** Chunk ids matching the question, best `ts_rank_cd` first. */
    public async fullText(
        kbs: readonly string[],
        question: string,
        match: FullTextMatch,
        filter: MetadataFilter,
        limit: number
    ): Promise<string[]> {
        const filterSql = metadataFilterSql(filter, 4);
        const { rows } = await this.postgres.query<{ id: string }>(
            `WITH q AS (
                 SELECT k.id AS kb, ${tsQuery(match)} AS query FROM knowledge_bases k WHERE k.id = ANY($1::text[])
             )
             SELECT c.id
             FROM q
             JOIN documents d ON d.kb = q.kb
             JOIN chunks c ON c.document_id = d.id
             WHERE q.query IS NOT NULL AND numnode(q.query) > 0 AND c.fts @@ q.query${filterSql.sql}
             ORDER BY ts_rank_cd(c.fts, q.query) DESC, c.id
             LIMIT $3`,
            [kbs, question, limit, ...filterSql.values]
        );

        return rows.map((row) => row.id);
    }

    /**
     * Chunk ids nearest to `vector` under `model`, nearest first.
     *
     * Written so the model's partial HNSW index applies: the same cast, the same literal model
     * name. Filters are applied after the index scan, so iterative scans are switched on — without
     * them a narrow filter can leave fewer than `limit` rows from an index that has more.
     */
    public vector(
        kbs: readonly string[],
        model: EmbeddingModelConfig,
        vector: readonly number[],
        filter: MetadataFilter,
        limit: number
    ): Promise<string[]> {
        const dims = model.dimensions;
        const distance = `e.embedding::vector(${dims}) <=> $2::vector(${dims})`;
        const filterSql = metadataFilterSql(filter, 4);

        return this.postgres.transaction(async (client) => {
            await client.query(`SET LOCAL hnsw.ef_search = ${Math.min(Math.max(40, limit), MAX_EF_SEARCH)}`);
            await client.query('SET LOCAL hnsw.iterative_scan = relaxed_order');

            const { rows } = await client.query<{ id: string; distance: number }>(
                `SELECT e.chunk_id AS id, ${distance} AS distance
                 FROM embeddings e
                 JOIN chunks c ON c.id = e.chunk_id
                 JOIN documents d ON d.id = c.document_id
                 WHERE e.model = ${modelLiteral(model.name)} AND d.kb = ANY($1::text[])${filterSql.sql}
                 ORDER BY ${distance}
                 LIMIT $3`,
                [kbs, toVectorLiteral(vector), limit, ...filterSql.values]
            );

            // relaxed_order may return rows slightly out of order; the distance is exact.
            return rows.sort((a, b) => a.distance - b.distance).map((row) => row.id);
        });
    }

    /**
     * What a result shows, for the given chunk ids, with a snippet around the question's terms
     * (or the start of the chunk when none of them occur — a vector-only hit).
     *
     * `demoted` marks what search ranks last without hiding: a document whose `status` is
     * `abandoned`, and one another document names in `supersedes`.
     */
    public async details(ids: readonly string[], question: string): Promise<SearchHitDTO[]> {
        if (CommonUtils.isEmpty(ids)) {
            return [];
        }

        const { rows } = await this.postgres.query(
            `WITH q AS (
                 SELECT k.id AS kb, ${tsQuery(FullTextMatch.Any)} AS query FROM knowledge_bases k
             )
             SELECT c.id, d.kb, d.external_id, c.anchor, d.title, c.heading,
                    coalesce(
                        ts_headline(k.ts_config, c.body, q.query,
                            'MaxWords=35, MinWords=15, MaxFragments=2, FragmentDelimiter=" … ", StartSel="**", StopSel="**"'),
                        left(c.body, 300)
                    ) AS snippet,
                    d.date::text AS date, d.url, d.metadata,
                    (coalesce(d.metadata->>'status', '') = 'abandoned'
                        OR EXISTS (
                            SELECT 1 FROM documents s
                            WHERE s.kb = d.kb AND s.id <> d.id AND s.metadata->'supersedes' @> to_jsonb(d.external_id)
                        )) AS demoted
             FROM chunks c
             JOIN documents d ON d.id = c.document_id
             JOIN knowledge_bases k ON k.id = d.kb
             LEFT JOIN q ON q.kb = d.kb
             WHERE c.id = ANY($1::bigint[])`,
            [ids, question]
        );

        return Serializer.deserializeArray(rows, SearchHitDTO);
    }
}
