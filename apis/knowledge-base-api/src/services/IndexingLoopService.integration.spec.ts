import { PlatformTest } from '@tsed/platform-http/testing';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaEndpoint } from '../endpoints/ollama/OllamaEndpoint.js';
import { RunOutcome } from '../models/RunOutcome.enum.js';
import { RunStart } from '../models/RunStart.enum.js';
import { Server } from '../Server.js';
import { SourceAdapterFactory } from '../sources/SourceAdapterFactory.js';
import { LOCK_INDEX } from '../storage/postgres/AdvisoryLock.js';
import { PostgresService } from '../storage/postgres/PostgresService.js';
import { FakeOllamaEndpoint } from '../test/FakeOllamaEndpoint.js';
import { FakeSourceAdapterFactory } from '../test/FakeSourceAdapterFactory.js';
import { sourceDocument } from '../test/fakes.js';
import { ConfigService } from './ConfigService.js';
import { IndexingLoopService } from './IndexingLoopService.js';

/** A run started by hand — the only kind that builds a knowledge base from nothing. */
const RUN = { knowledgeBases: ['development'], full: false, manual: true };
const SCHEDULED = { ...RUN, manual: false };

/**
 * The loop around the indexer, on the full server: run records, the incremental-only rule, the
 * cross-pod lock and the trigger queue. What one run does to the index is `IndexerService.spec`.
 */
describe('IndexingLoopService (integration)', () => {
    let sources: FakeSourceAdapterFactory;
    let ollama: FakeOllamaEndpoint;
    let loop: IndexingLoopService;
    let postgres: PostgresService;

    const count = async (sql: string): Promise<number> => Number((await postgres.query<{ n: string }>(sql)).rows[0].n);
    const knowledgeBase = async () => (await postgres.query<{ cursor: string; last_run_outcome: string; last_run_error: string | null }>(
        "SELECT cursor, last_run_outcome, last_run_error FROM knowledge_bases WHERE id = 'development'"
    )).rows[0];

    beforeEach(async () => {
        ollama = new FakeOllamaEndpoint();
        sources = new FakeSourceAdapterFactory();

        await PlatformTest.bootstrap(Server, {
            imports: [
                { token: OllamaEndpoint, use: ollama },
                { token: SourceAdapterFactory, use: sources }
            ]
        })();

        loop = PlatformTest.get<IndexingLoopService>(IndexingLoopService);
        postgres = PlatformTest.get<PostgresService>(PostgresService);
        await postgres.query('TRUNCATE documents CASCADE');
        await postgres.query("UPDATE knowledge_bases SET cursor = NULL WHERE id = 'development'");
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('records a successful run with its cursor', async () => {
        expect.assertions(2);

        sources.adapter.next = { upserts: [sourceDocument('raw/a.md', '## A\n\nalpha')], deletes: [], cursor: 'c1', complete: true };

        await loop.run(RUN);

        expect(await knowledgeBase()).toEqual({ cursor: 'c1', last_run_outcome: RunOutcome.Success, last_run_error: null });
        expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(1);
    });

    it('records a run as successful even when the embedder is down — the vectors stay pending', async () => {
        expect.assertions(2);

        ollama.failing = true;
        sources.adapter.next = { upserts: [sourceDocument('raw/a.md', '## A\n\nalpha')], deletes: [], cursor: 'c1', complete: true };

        await loop.run(RUN);

        expect((await knowledgeBase()).last_run_outcome).toBe(RunOutcome.Success);
        expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(0);
    });

    it('records a failed run and keeps the cursor, so the next run repeats from it', async () => {
        expect.assertions(1);

        sources.adapter.next = { upserts: [], deletes: [], cursor: 'c1', complete: true };
        await loop.run(RUN);

        sources.adapter.failure = new Error('GitHub is down');
        await loop.run(RUN);

        expect(await knowledgeBase()).toEqual({ cursor: 'c1', last_run_outcome: RunOutcome.Failure, last_run_error: 'GitHub is down' });
    });

    describe('scheduled runs are incremental only', () => {
        it('leave a knowledge base that was never indexed for a run started by hand', async () => {
            expect.assertions(2);

            sources.adapter.next = { upserts: [sourceDocument('raw/a.md', '## A\n\nalpha')], deletes: [], cursor: 'c1', complete: true };

            await loop.run(SCHEDULED);

            expect(sources.adapter.cursors).toEqual([]);
            expect(await count('SELECT count(*) AS n FROM documents')).toBe(0);
        });

        it('index what changed once the knowledge base is built', async () => {
            expect.assertions(2);

            sources.adapter.next = { upserts: [], deletes: [], cursor: 'c1', complete: true };
            await loop.run(RUN);

            sources.adapter.next = { upserts: [sourceDocument('raw/a.md', '## A\n\nalpha')], deletes: [], cursor: 'c2', complete: false };
            await loop.run(SCHEDULED);

            expect(sources.adapter.cursors).toEqual([null, 'c1']);
            expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(1);
        });
    });

    describe('one indexer at a time', () => {
        it('skips the run while another pod holds the lock', async () => {
            expect.assertions(2);

            const config = PlatformTest.get<ConfigService>(ConfigService).config.database;
            const other = new pg.Client({ host: config.host, port: config.port, database: config.database, user: config.user, password: config.password });

            await other.connect();
            await other.query('SELECT pg_advisory_lock($1, $2)', [LOCK_INDEX.namespace, LOCK_INDEX.key]);

            try {
                sources.adapter.next = { upserts: [sourceDocument('raw/a.md', '## A\n\nalpha')], deletes: [], cursor: 'c1', complete: true };
                await loop.run(RUN);

                expect(sources.adapter.cursors).toEqual([]);
                expect(await count('SELECT count(*) AS n FROM documents')).toBe(0);
            } finally {
                await other.end();
            }
        });
    });

    describe('trigger', () => {
        it('queues a request that arrives during a run and runs it afterwards', async () => {
            expect.assertions(6);

            let release!: () => void;
            const blocked = new Promise<void>((resolve) => {
                release = resolve;
            });
            const changes = sources.adapter.changes.bind(sources.adapter);

            sources.adapter.changes = async (cursor) => {
                await blocked;

                return changes(cursor);
            };
            sources.adapter.next = { upserts: [], deletes: [], cursor: 'c1', complete: true };

            await expect(loop.trigger(RUN)).resolves.toBe(RunStart.Started);
            await expect.poll(() => loop.isRunning).toBe(true);
            await expect(loop.trigger({ ...RUN, full: true })).resolves.toBe(RunStart.Queued);

            release();
            await expect.poll(() => sources.adapter.cursors.length).toBe(2);
            await expect.poll(() => loop.isRunning).toBe(false);
            expect(sources.adapter.cursors).toEqual([null, null]);
        });
    });
});
