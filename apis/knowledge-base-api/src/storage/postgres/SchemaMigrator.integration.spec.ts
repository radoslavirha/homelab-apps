import { PlatformTest } from '@tsed/platform-http/testing';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../../services/ConfigService.js';
import { bootstrapIndexed } from '../../test/bootstrapIndexed.js';
import { PostgresService } from './PostgresService.js';
import { SchemaMigrator } from './SchemaMigrator.js';

describe('SchemaMigrator (integration)', () => {
    let postgres: PostgresService;
    let client: pg.Client;
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    beforeEach(async () => {
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
        expect.assertions(2);

        await migrate('english');

        expect(await matches('english', 'probes')).toBeGreaterThan(0);
        expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('chunk vectors rewritten'), expect.anything());
    });

    it('rewrites the full-text vectors of a knowledge base whose text search configuration changed', async () => {
        expect.assertions(3);

        // english stems "probes" to "probe"; simple keeps the word as written.
        expect(await matches('simple', 'probes')).toBe(0);

        await migrate('simple');

        expect(await matches('simple', 'probes')).toBeGreaterThan(0);
        expect((await postgres.query<{ ts_config: string }>("SELECT ts_config::text FROM knowledge_bases WHERE id = 'dev'")).rows[0].ts_config).toBe('simple');
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
