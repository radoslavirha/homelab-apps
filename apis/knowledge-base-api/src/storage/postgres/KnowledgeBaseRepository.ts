import { Serializer } from '@radoslavirha/tsed-common';
import { CommonUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { RunOutcome } from '../../models/RunOutcome.enum.js';
import { AreaCountDTO } from './dto/AreaCountDTO.js';
import { KnowledgeBaseDTO } from './dto/KnowledgeBaseDTO.js';
import { KnowledgeBaseStatsDTO } from './dto/KnowledgeBaseStatsDTO.js';
import { ModelCountDTO } from './dto/ModelCountDTO.js';
import { PostgresService } from './PostgresService.js';

/** Longest error text kept on a run — enough to read, not a stack trace. */
const MAX_ERROR_LENGTH = 500;

const ROW_COLUMNS = `
    id, source, ts_config::text AS ts_config, cursor,
    last_run_started_at, last_run_finished_at, last_run_outcome, last_run_error, last_success_at`;

@Service()
@Scope(ProviderScope.SINGLETON)
export class KnowledgeBaseRepository {
    public constructor(private readonly postgres: PostgresService) {}

    public async list(ids: readonly string[]): Promise<KnowledgeBaseDTO[]> {
        const { rows } = await this.postgres.query(
            `SELECT ${ROW_COLUMNS} FROM knowledge_bases WHERE id = ANY($1::text[]) ORDER BY id`,
            [ids]
        );

        return Serializer.deserializeArray(rows, KnowledgeBaseDTO);
    }

    public async getCursor(id: string): Promise<string | null> {
        const { rows } = await this.postgres.query<{ cursor: string | null }>(
            'SELECT cursor FROM knowledge_bases WHERE id = $1',
            [id]
        );

        return rows[0]?.cursor ?? null;
    }

    public async setCursor(id: string, cursor: string): Promise<void> {
        await this.postgres.query('UPDATE knowledge_bases SET cursor = $2 WHERE id = $1', [id, cursor]);
    }

    /** Clears the cursor, so the next run asks the source for everything. */
    public async resetCursor(id: string): Promise<void> {
        await this.postgres.query('UPDATE knowledge_bases SET cursor = NULL WHERE id = $1', [id]);
    }

    public async recordRunStart(id: string): Promise<void> {
        await this.postgres.query(
            `UPDATE knowledge_bases
             SET last_run_started_at = now(), last_run_finished_at = NULL, last_run_outcome = NULL, last_run_error = NULL
             WHERE id = $1`,
            [id]
        );
    }

    /** Returns the KB's last success time after the update. */
    public async recordRunEnd(id: string, outcome: RunOutcome, error: string | null): Promise<Date | null> {
        const { rows } = await this.postgres.query(
            `UPDATE knowledge_bases
             SET last_run_finished_at = now(), last_run_outcome = $2, last_run_error = $3,
                 last_success_at = CASE WHEN $4::boolean THEN now() ELSE last_success_at END
             WHERE id = $1
             RETURNING ${ROW_COLUMNS}`,
            [id, outcome, CommonUtils.isNull(error) ? null : error.slice(0, MAX_ERROR_LENGTH), outcome === RunOutcome.Success]
        );
        const [row] = Serializer.deserializeArray(rows, KnowledgeBaseDTO);

        return row?.lastSuccessAt ?? null;
    }

    public async stats(id: string): Promise<KnowledgeBaseStatsDTO> {
        const [counts, areas, embedded] = await Promise.all([
            this.postgres.query<{ documents: number; chunks: number }>(
                `SELECT (SELECT count(*)::int FROM documents WHERE kb = $1) AS documents,
                        (SELECT count(*)::int FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.kb = $1) AS chunks`,
                [id]
            ),
            this.postgres.query(
                `SELECT coalesce(metadata->>'area', '') AS area, count(*)::int AS documents
                 FROM documents WHERE kb = $1 GROUP BY 1 ORDER BY 1`,
                [id]
            ),
            this.postgres.query(
                `SELECT e.model, count(*)::int AS chunks
                 FROM embeddings e JOIN chunks c ON c.id = e.chunk_id JOIN documents d ON d.id = c.document_id
                 WHERE d.kb = $1 GROUP BY e.model ORDER BY e.model`,
                [id]
            )
        ]);

        return CommonUtils.buildModelStrict(KnowledgeBaseStatsDTO, {
            documents: counts.rows[0].documents,
            chunks: counts.rows[0].chunks,
            areas: Serializer.deserializeArray(areas.rows, AreaCountDTO),
            embedded: Serializer.deserializeArray(embedded.rows, ModelCountDTO)
        });
    }
}
