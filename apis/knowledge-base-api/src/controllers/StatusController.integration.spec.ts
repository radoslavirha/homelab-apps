import { PlatformTest } from '@tsed/platform-http/testing';
import type SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunOutcome } from '../models/RunOutcome.enum.js';
import { bootstrapIndexed } from '../test/bootstrapIndexed.js';
import { CORPUS } from '../test/corpus.js';
import { FOREIGN_AUDIENCE, noRoleToken, readerToken, refusedCredentials } from '../test/tokens.js';

describe('StatusController (integration)', () => {
    let request: SuperTest.Agent;

    beforeEach(async () => {
        ({ request } = await bootstrapIndexed());
    });
    afterEach(PlatformTest.reset);

    it('reports the indexed revision, the last run, counts per area and embedding progress', async () => {
        expect.assertions(5);

        const response = await request.get('/status').set('Authorization', `Bearer ${await readerToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.indexer).toEqual({ enabled: false, intervalMs: 300_000, running: false });

        const [kb] = response.body.knowledgeBases;

        expect(kb).toMatchObject({
            id: 'development',
            source: 'GIT',
            cursor: 'c1',
            lastRun: { outcome: RunOutcome.Success, error: null },
            documents: CORPUS.length,
            chunks: CORPUS.length,
            areas: [
                { area: 'mirror', documents: 1 },
                { area: 'raw', documents: 4 },
                { area: 'work', documents: 2 }
            ],
            models: [{ name: 'test-embed:v1', dimensions: 4, active: true, embedded: CORPUS.length, pending: 0 }]
        });
        expect(new Date(kb.lastSuccessAt).getTime()).toBeGreaterThan(0);
        expect(new Date(kb.lastRun.finishedAt).getTime()).toBeGreaterThanOrEqual(new Date(kb.lastRun.startedAt).getTime());
    });

    it('refuses without the reader role', async () => {
        expect.assertions(2);

        expect((await request.get('/status')).status).toBe(401);
        expect((await request.get('/status').set('Authorization', `Bearer ${await noRoleToken()}`)).status).toBe(403);
    });

    it('refuses a forged, foreign, expired or non-bearer credential with 401, saying nothing about why', async () => {
        const credentials = await refusedCredentials();

        expect.assertions(credentials.length * 2);

        for (const [reason, authorization] of credentials) {
            const response = await request.get('/status').set('Authorization', authorization);

            expect(response.status, reason).toBe(401);
            expect(JSON.stringify(response.body), reason).not.toContain(FOREIGN_AUDIENCE);
        }
    });
});
