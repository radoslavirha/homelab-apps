import { Serializer } from '@radoslavirha/tsed-common';
import { CommonUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { PendingChunkDTO } from './dto/PendingChunkDTO.js';
import { PostgresService } from './PostgresService.js';
import { toVectorLiteral } from './sql.js';

@Service()
@Scope(ProviderScope.SINGLETON)
export class EmbeddingRepository {
    public constructor(private readonly postgres: PostgresService) {}

    /**
     * Gives chunks with no vector for `model` the vector of another chunk with the same hash —
     * same title, heading and body, so the same embedded text. A renamed file arrives as a new
     * document; this keeps it from being embedded a second time. Returns how many were copied.
     */
    public async copyByHash(kb: string, model: string): Promise<number> {
        const result = await this.postgres.query(
            `INSERT INTO embeddings (chunk_id, model, embedding)
             SELECT DISTINCT ON (c.id) c.id, e.model, e.embedding
             FROM chunks c
             JOIN documents d ON d.id = c.document_id
             JOIN chunks twin ON twin.hash = c.hash AND twin.id <> c.id
             JOIN embeddings e ON e.chunk_id = twin.id AND e.model = $2
             WHERE d.kb = $1
               AND NOT EXISTS (SELECT 1 FROM embeddings own WHERE own.chunk_id = c.id AND own.model = $2)
             ORDER BY c.id
             ON CONFLICT DO NOTHING`,
            [kb, model]
        );

        return result.rowCount ?? 0;
    }

    /** How many chunks of the KB have no vector for `model`. */
    public async countPending(kb: string, model: string): Promise<number> {
        const { rows } = await this.postgres.query<{ n: string }>(
            `SELECT count(*) AS n
             FROM chunks c JOIN documents d ON d.id = c.document_id
             WHERE d.kb = $1
               AND NOT EXISTS (SELECT 1 FROM embeddings e WHERE e.chunk_id = c.id AND e.model = $2)`,
            [kb, model]
        );

        return Number(rows[0].n);
    }

    /** Chunks of the KB with no vector for `model`, oldest first. */
    public async pending(kb: string, model: string, limit: number): Promise<PendingChunkDTO[]> {
        const { rows } = await this.postgres.query(
            `SELECT c.id, d.title, c.heading, c.body
             FROM chunks c JOIN documents d ON d.id = c.document_id
             WHERE d.kb = $1
               AND NOT EXISTS (SELECT 1 FROM embeddings e WHERE e.chunk_id = c.id AND e.model = $2)
             ORDER BY c.id
             LIMIT $3`,
            [kb, model, limit]
        );

        return Serializer.deserializeArray(rows, PendingChunkDTO);
    }

    /**
     * Stores vectors. A chunk deleted meanwhile is skipped rather than failing the batch; a
     * vector of the wrong length fails it, through the cast in the model's index.
     */
    public async insert(model: string, vectors: readonly { chunkId: string; vector: readonly number[] }[]): Promise<number> {
        if (CommonUtils.isEmpty(vectors)) {
            return 0;
        }

        const result = await this.postgres.query(
            `INSERT INTO embeddings (chunk_id, model, embedding)
             SELECT v.chunk_id, $1, v.embedding::vector
             FROM unnest($2::bigint[], $3::text[]) AS v(chunk_id, embedding)
             WHERE EXISTS (SELECT 1 FROM chunks c WHERE c.id = v.chunk_id)
             ON CONFLICT (chunk_id, model) DO NOTHING`,
            [model, vectors.map((v) => v.chunkId), vectors.map((v) => toVectorLiteral(v.vector))]
        );

        return result.rowCount ?? 0;
    }
}
