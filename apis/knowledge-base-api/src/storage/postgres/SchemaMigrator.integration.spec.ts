import { PlatformTest } from '@tsed/platform-http/testing';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../../services/ConfigService.js';
import { bootstrapIndexed } from '../../test/bootstrapIndexed.js';
import { chunkDTO, documentDTO, seedDocument } from '../../test/seed.js';
import { PostgresService } from './PostgresService.js';
import { SchemaMigrator } from './SchemaMigrator.js';

describe('SchemaMigrator (integration)', () => {
    let postgres: PostgresService;
    let client: pg.Client;
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    beforeEach(async () => {
        vi.clearAllMocks();
        await bootstrapIndexed();
        postgres = PlatformTest.get<PostgresService>(PostgresService);

        const db = PlatformTest.get<ConfigService>(ConfigService).config.database;

        client = new pg.Client({ host: db.host, port: db.port, database: db.database, user: db.user, password: db.password });
        await client.connect();
    });
    afterEach(async () => {
        await client.end();
        await PlatformTest.reset();
    });

    const migrate = (tsConfig: string, models = PlatformTest.get<ConfigService>(ConfigService).config.embeddings.models) =>
        new SchemaMigrator(client as unknown as pg.PoolClient, logger).migrate({
            models,
            knowledgeBases: PlatformTest.get<ConfigService>(ConfigService).config.knowledgeBases.map((kb) => ({ ...kb, tsConfig }))
        });

    const matches = async (config: string, word: string): Promise<number> => Number((await postgres.query<{ n: string }>(
        `SELECT count(*) AS n FROM chunks WHERE fts @@ to_tsquery('${config}', $1)`,
        [word]
    )).rows[0].n);

    it('is idempotent: a second run on a migrated database changes nothing', async () => {
        expect.assertions(3);

        await migrate('english');

        expect(await matches('english', 'probes')).toBeGreaterThan(0);
        expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('chunk vectors rewritten'), expect.anything());
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('removes a knowledge base that is no longer configured, with its documents, chunks and embeddings', async () => {
        expect.assertions(4);

        const counts = async (kb: string): Promise<{ documents: string; chunks: string; embeddings: string }> => (await postgres.query<{ documents: string; chunks: string; embeddings: string }>(
            `SELECT count(DISTINCT d.id) AS documents, count(DISTINCT c.id) AS chunks, count(e.chunk_id) AS embeddings
             FROM documents d LEFT JOIN chunks c ON c.document_id = d.id LEFT JOIN embeddings e ON e.chunk_id = c.id
             WHERE d.kb = $1`,
            [kb]
        )).rows[0];

        // A knowledge base an earlier configuration declared (a renamed one's old id), indexed and embedded.
        await postgres.query("INSERT INTO knowledge_bases (id, source, ts_config) VALUES ('retired', 'GIT', 'english')");
        await seedDocument(documentDTO('raw/old.md', { kb: 'retired' }), [chunkDTO(0, 'A', 'alpha'), chunkDTO(1, 'B', 'beta')]);
        await postgres.query(
            `INSERT INTO embeddings (chunk_id, model, embedding)
             SELECT c.id, 'test-embed:v1', '[1,0,0,0]' FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.kb = 'retired'`
        );
        const configured = await counts('development');

        await migrate('english');

        expect((await postgres.query<{ id: string }>('SELECT id FROM knowledge_bases ORDER BY id')).rows).toEqual([{ id: 'development' }]);
        expect(await counts('retired')).toEqual({ documents: '0', chunks: '0', embeddings: '0' });
        expect(await counts('development')).toEqual(configured);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('no longer configured'),
            { event: 'DB_MIGRATION', knowledgeBase: 'retired', documents: 1, chunks: 2 }
        );
    });

    it('rewrites the full-text vectors of a knowledge base whose text search configuration changed', async () => {
        expect.assertions(3);

        // english stems "probes" to "probe"; simple keeps the word as written.
        expect(await matches('simple', 'probes')).toBe(0);

        await migrate('simple');

        expect(await matches('simple', 'probes')).toBeGreaterThan(0);
        expect((await postgres.query<{ ts_config: string }>("SELECT ts_config::text FROM knowledge_bases WHERE id = 'development'")).rows[0].ts_config).toBe('simple');
    });

    it('creates the index of a model added to configuration', async () => {
        expect.assertions(2);

        await migrate('english', [{ name: 'second:1b', dimensions: 8, documentTemplate: '{text}', queryTemplate: '{query}' }]);

        const { rows } = await postgres.query<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE indexdef LIKE '%second:1b%'");

        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain('vector(8)');
    });

    describe('a model whose dimensions changed', () => {
        const indexesOf = async (model: string): Promise<string[]> => (await postgres.query<{ indexdef: string }>(
            'SELECT indexdef FROM pg_indexes WHERE tablename = $1 AND indexdef LIKE $2',
            ['embeddings', `%'${model}'%`]
        )).rows.map((row) => row.indexdef);

        it('drops the index left under the old dimension when no vector of that size is stored', async () => {
            expect.assertions(3);

            const model = { name: 'second:1b', documentTemplate: '{text}', queryTemplate: '{query}' };

            // Configured with the wrong size first: nothing could be stored under it.
            await migrate('english', [{ ...model, dimensions: 8 }]);
            await migrate('english', [{ ...model, dimensions: 16 }]);

            const indexes = await indexesOf('second:1b');

            expect(indexes).toHaveLength(1);
            expect(indexes[0]).toContain('vector(16)');
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Dropped the index'), expect.objectContaining({ model: 'second:1b' }));
        });

        it('refuses to boot when vectors of the old size are stored, and says what to do', async () => {
            expect.assertions(2);

            // The indexed corpus holds 4-dimension vectors of test-embed:v1.
            const [model] = PlatformTest.get<ConfigService>(ConfigService).config.embeddings.models;

            await expect(migrate('english', [{ ...model, dimensions: 8 }])).rejects.toThrow(/cannot change under one name: add it as a new model entry/);
            expect(await indexesOf(model.name)).toEqual([expect.stringContaining('vector(4)')]);
        });
    });

    it('refuses a text search configuration Postgres does not have', async () => {
        expect.assertions(1);

        await expect(migrate('klingon')).rejects.toThrow(/text search configuration "klingon" does not exist/);
    });
});
