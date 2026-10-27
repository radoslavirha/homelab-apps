import { PrincipalService } from '@radoslavirha/tsed-auth';
import { PlatformTest } from '@tsed/platform-http/testing';
import pg from 'pg';
import type SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../services/ConfigService.js';
import { IndexerService } from '../services/IndexerService.js';
import { IndexingLoopService } from '../services/IndexingLoopService.js';
import { LOCK_INDEX } from '../storage/postgres/AdvisoryLock.js';
import { bootstrapIndexed } from '../test/bootstrapIndexed.js';
import type { FakeSourceAdapterFactory } from '../test/FakeSourceAdapterFactory.js';
import { adminToken, FOREIGN_AUDIENCE, readerToken, refusedCredentials } from '../test/tokens.js';

describe('ReindexController (integration)', () => {
    let request: SuperTest.Agent;
    let sources: FakeSourceAdapterFactory;

    beforeEach(async () => {
        ({ request, sources } = await bootstrapIndexed());
        sources.adapter.cursors.length = 0;
        sources.adapter.next = { upserts: [], deletes: [], cursor: 'c2', complete: false };
    });
    afterEach(PlatformTest.reset);

    const idle = async (): Promise<void> => {
        await expect.poll(() => PlatformTest.get<IndexingLoopService>(IndexingLoopService).isRunning).toBe(false);
    };

    const reindex = async (query: Record<string, string | boolean> = {}): Promise<SuperTest.Response> =>
        request.post('/reindex').query(query).set('Authorization', `Bearer ${await adminToken()}`);

    it('starts a run and answers 202 STARTED once it holds the lock', async () => {
        expect.assertions(4); // idle() polls once more

        const response = await reindex();

        expect(response.status).toBe(202);
        expect(response.body).toEqual({ knowledgeBases: ['development'], full: false, state: 'STARTED' });

        await expect.poll(() => sources.adapter.cursors).toEqual(['c1']);
        await idle();
    });

    it('runs outside the request, so the run has no caller — not the admin who asked for it', async () => {
        expect.assertions(4); // idle() polls once more

        const principals = PlatformTest.get<PrincipalService>(PrincipalService);
        const indexer = PlatformTest.get<IndexerService>(IndexerService);
        const index = indexer.index.bind(indexer);
        const callers: unknown[] = [];

        vi.spyOn(indexer, 'index').mockImplementation((kb, options) => {
            callers.push(principals.current());

            return index(kb, options);
        });

        expect((await request.post('/reindex').set('Authorization', `Bearer ${await adminToken()}`)).status).toBe(202);

        await expect.poll(() => callers).toHaveLength(1);
        expect(callers[0]).toBeUndefined();
        await idle();
    });

    it('answers 202 QUEUED while a run is in progress in this pod', async () => {
        expect.assertions(5); // idle() polls once more

        sources.adapter.hanging = true;
        expect((await reindex()).body.state).toBe('STARTED');
        await expect.poll(() => sources.adapter.reading).toBe(1);

        const queued = await reindex({ full: true });

        expect(queued.status).toBe(202);
        expect(queued.body).toEqual({ knowledgeBases: ['development'], full: true, state: 'QUEUED' });

        // Stopping the pod ends the hanging run; the queued one is not started during shutdown.
        await PlatformTest.get<IndexingLoopService>(IndexingLoopService).$onDestroy();
        await idle();
    });

    it('answers 409 when another pod holds the index lock, and starts nothing', async () => {
        expect.assertions(3);

        const db = PlatformTest.get<ConfigService>(ConfigService).config.database;
        const otherPod = new pg.Client({ host: db.host, port: db.port, database: db.database, user: db.user, password: db.password });

        await otherPod.connect();
        await otherPod.query('SELECT pg_advisory_lock($1, $2)', [LOCK_INDEX.namespace, LOCK_INDEX.key]);

        try {
            const response = await reindex({ full: true });

            expect(response.status).toBe(409);
            expect(response.body.message).toBe('Another pod is indexing; nothing was started. Try again when its run ends.');
            expect(sources.adapter.cursors).toEqual([]);
        } finally {
            await otherPod.end();
        }
    });

    it('runs from scratch with full=true', async () => {
        expect.assertions(4); // idle() polls once more

        const response = await request.post('/reindex').query({ full: true }).set('Authorization', `Bearer ${await adminToken()}`);

        expect(response.status).toBe(202);
        expect(response.body.full).toBe(true);

        await expect.poll(() => sources.adapter.cursors).toEqual([null]);
        await idle();
    });

    it('is refused to a reader: admin is required on top of the reader floor', async () => {
        expect.assertions(3);

        expect((await request.post('/reindex').set('Authorization', `Bearer ${await readerToken()}`)).status).toBe(403);
        expect((await request.post('/reindex')).status).toBe(401);
        expect(sources.adapter.cursors).toEqual([]);
    });

    it('refuses a forged, foreign, expired or non-bearer credential with 401, saying nothing about why', async () => {
        const credentials = await refusedCredentials();

        expect.assertions(credentials.length * 2);

        for (const [reason, authorization] of credentials) {
            const response = await request.post('/reindex').set('Authorization', authorization);

            expect(response.status, reason).toBe(401);
            expect(JSON.stringify(response.body), reason).not.toContain(FOREIGN_AUDIENCE);
        }
    });

    it('answers 404 for a knowledge base the caller cannot read', async () => {
        expect.assertions(1);

        expect((await request.post('/reindex').query({ kb: 'home' }).set('Authorization', `Bearer ${await adminToken()}`)).status).toBe(404);
    });
});
