import { fileURLToPath } from 'node:url';
import { CommonUtils } from '@radoslavirha/utils';
import { runner } from 'node-pg-migrate';
import type pg from 'pg';
import type { EmbeddingModelConfig } from '../../models/config/EmbeddingsConfig.js';
import type { KnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import { LOCK_MIGRATE } from './AdvisoryLock.js';
import { ftsExpression, modelIndexName, modelLiteral } from './sql.js';

/** `src/migrations` in development and tests, `dist/migrations` in the image. */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

export const MIGRATIONS_TABLE = 'pgmigrations';

export interface SchemaMigratorLogger {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}

export interface SchemaTarget {
    readonly models: readonly EmbeddingModelConfig[];
    readonly knowledgeBases: readonly KnowledgeBaseConfig[];
}

/**
 * Brings the database to what this release and this configuration need, in two steps:
 *
 * 1. **Numbered migrations** (`src/migrations`) through node-pg-migrate — the tables. Two pods
 *    starting together queue on its advisory lock instead of racing the DDL.
 * 2. **Configuration**, which a numbered migration cannot know: one partial HNSW index per
 *    embedding model, and one `knowledge_bases` row per configured KB. Adding a model or a KB is
 *    a config change and needs no release. A KB whose `tsConfig` changed gets its full-text
 *    vectors rewritten here, since the old ones were built in the old language.
 *
 * Nothing is ever dropped from configuration: removing a KB or a model leaves its rows and
 * index in place, unused. Cleaning up is a deliberate act, not a side effect of a values edit.
 */
export class SchemaMigrator {
    public constructor(
        private readonly client: pg.PoolClient,
        private readonly logger: SchemaMigratorLogger
    ) {}

    public async migrate(target: SchemaTarget): Promise<void> {
        const applied = await runner({
            dbClient: this.client,
            dir: MIGRATIONS_DIR,
            migrationsTable: MIGRATIONS_TABLE,
            direction: 'up',
            checkOrder: true,
            singleTransaction: true,
            advisoryLockMode: 'wait',
            logger: {
                info: (message) => this.logger.info(message, { event: 'DB_MIGRATION' }),
                warn: (message) => this.logger.warn(message, { event: 'DB_MIGRATION' }),
                error: (message) => this.logger.error(message, { event: 'DB_MIGRATION' })
            }
        });

        if (!CommonUtils.isEmpty(applied)) {
            this.logger.info('Database migrations applied.', { event: 'DB_MIGRATION', migrations: applied.map((m) => m.name) });
        }

        await this.client.query('SELECT pg_advisory_lock($1, $2)', [LOCK_MIGRATE.namespace, LOCK_MIGRATE.key]);

        try {
            for (const model of target.models) {
                await this.ensureModelIndex(model);
            }

            for (const kb of target.knowledgeBases) {
                await this.ensureKnowledgeBase(kb);
            }
        } finally {
            await this.client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_MIGRATE.namespace, LOCK_MIGRATE.key]);
        }
    }

    /**
     * The search query must cast with the same dimension and filter on the same literal model
     * name, or the planner cannot use this index.
     */
    private async ensureModelIndex(model: EmbeddingModelConfig): Promise<void> {
        await this.client.query(
            `CREATE INDEX IF NOT EXISTS ${modelIndexName(model.name, model.dimensions)} ON embeddings ` +
            `USING hnsw ((embedding::vector(${model.dimensions})) vector_cosine_ops) ` +
            `WHERE model = ${modelLiteral(model.name)}`
        );
    }

    private async ensureKnowledgeBase(kb: KnowledgeBaseConfig): Promise<void> {
        const { rows } = await this.client.query<{ previous: string | null; current: string }>(
            `WITH previous AS (SELECT ts_config FROM knowledge_bases WHERE id = $1)
             INSERT INTO knowledge_bases (id, source, ts_config) VALUES ($1, $2, $3::regconfig)
             ON CONFLICT (id) DO UPDATE SET source = EXCLUDED.source, ts_config = EXCLUDED.ts_config
             RETURNING (SELECT ts_config::text FROM previous) AS previous, ts_config::text AS current`,
            [kb.id, kb.source, kb.tsConfig]
        );
        const [{ previous, current }] = rows;

        if (CommonUtils.notNull(previous) && previous !== current) {
            const result = await this.client.query(
                `UPDATE chunks c SET fts = ${ftsExpression('k.ts_config', 'd.title', 'c.heading', 'c.body')}
                 FROM documents d JOIN knowledge_bases k ON k.id = d.kb
                 WHERE d.id = c.document_id AND d.kb = $1`,
                [kb.id]
            );

            this.logger.info('Full-text configuration changed; chunk vectors rewritten.', {
                event: 'DB_MIGRATION',
                knowledgeBase: kb.id,
                from: previous,
                to: current,
                chunks: result.rowCount ?? 0
            });
        }
    }
}
