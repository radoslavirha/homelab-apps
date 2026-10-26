import { PlatformTest } from '@tsed/platform-http/testing';
import type SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapIndexed } from '../test/bootstrapIndexed.js';
import { CORPUS } from '../test/corpus.js';
import { chunkDTO, documentDTO, seedDocument } from '../test/seed.js';
import { FOREIGN_AUDIENCE, noRoleToken, readerToken, refusedCredentials } from '../test/tokens.js';

describe('DocumentsController (integration)', () => {
    let request: SuperTest.Agent;

    const get = async (query: Record<string, string>, token?: string): Promise<SuperTest.Response> =>
        request.get('/documents').query(query).set('Authorization', `Bearer ${token ?? await readerToken()}`);

    beforeEach(async () => {
        ({ request } = await bootstrapIndexed());
    });
    afterEach(PlatformTest.reset);

    it('returns the whole document as indexed', async () => {
        expect.assertions(2);

        const [note] = CORPUS;
        const response = await get({ id: note.externalId });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            kb: 'dev',
            externalId: note.externalId,
            title: note.title,
            date: '2026-01-01',
            url: note.url,
            version: 'c1',
            metadata: note.metadata,
            content: note.content
        });
    });

    it('accepts a search result\'s anchor and returns the whole document', async () => {
        expect.assertions(2);

        const response = await get({ id: `${CORPUS[0].externalId}#fact` });

        expect(response.status).toBe(200);
        expect(response.body.externalId).toBe(CORPUS[0].externalId);
    });

    it('finds a path that itself holds a #, with or without an anchor', async () => {
        expect.assertions(2);

        const id = 'raw/2026-01-09-c#-notes.md';

        await seedDocument(documentDTO(id), [chunkDTO(0, 'Fact', 'A path may hold a hash.')]);

        expect((await get({ id })).body.externalId).toBe(id);
        expect((await get({ id: `${id}#fact` })).body.externalId).toBe(id);
    });

    it('rejects a NUL byte in the id as a bad request, not a server error', async () => {
        expect.assertions(1);

        expect((await get({ id: 'x\0' })).status).toBe(400);
    });

    it('answers 404 for an id nobody holds', async () => {
        expect.assertions(1);

        expect((await get({ id: 'raw/missing.md' })).status).toBe(404);
    });

    it('answers 404 for a knowledge base the caller cannot read', async () => {
        expect.assertions(1);

        expect((await get({ id: CORPUS[0].externalId, kb: 'home' })).status).toBe(404);
    });

    it('refuses without a credential and without the reader role', async () => {
        expect.assertions(2);

        expect((await request.get('/documents').query({ id: CORPUS[0].externalId })).status).toBe(401);
        expect((await get({ id: CORPUS[0].externalId }, await noRoleToken())).status).toBe(403);
    });

    it('refuses a forged, foreign, expired or non-bearer credential with 401, saying nothing about why', async () => {
        const credentials = await refusedCredentials();

        expect.assertions(credentials.length * 2);

        for (const [reason, authorization] of credentials) {
            const response = await request.get('/documents').query({ id: CORPUS[0].externalId }).set('Authorization', authorization);

            expect(response.status, reason).toBe(401);
            expect(JSON.stringify(response.body), reason).not.toContain(FOREIGN_AUDIENCE);
        }
    });
});
