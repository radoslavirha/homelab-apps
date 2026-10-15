import { PrincipalService } from '@radoslavirha/tsed-auth';
import { PlatformTest } from '@tsed/platform-http/testing';
import type SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexerService } from '../services/IndexerService.js';
import { IndexingLoopService } from '../services/IndexingLoopService.js';
import { bootstrapIndexed } from '../test/bootstrapIndexed.js';
import type { FakeSourceAdapterFactory } from '../test/FakeSourceAdapterFactory.js';
import { adminToken, readerToken } from '../test/tokens.js';

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

    it('starts a run and answers 202 at once', async () => {
        expect.assertions(4); // idle() polls once more

        const response = await request.post('/reindex').set('Authorization', `Bearer ${await adminToken()}`);

        expect(response.status).toBe(202);
        expect(response.body).toEqual({ knowledgeBases: ['dev'], full: false, queued: false });

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

    it('answers 404 for a knowledge base the caller cannot read', async () => {
        expect.assertions(1);

        expect((await request.post('/reindex').query({ kb: 'home' }).set('Authorization', `Bearer ${await adminToken()}`)).status).toBe(404);
    });
});
