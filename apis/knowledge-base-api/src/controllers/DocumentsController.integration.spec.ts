import { PlatformTest } from '@tsed/platform-http/testing';
import type SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapIndexed } from '../test/bootstrapIndexed.js';
import { bootstrapWritable, type WritableServer } from '../test/bootstrapWritable.js';
import { CORPUS } from '../test/corpus.js';
import { FakeGitHubEndpoint } from '../test/FakeGitHubEndpoint.js';
import { chunkDTO, documentDTO, seedDocument } from '../test/seed.js';
import { editorToken, FOREIGN_AUDIENCE, noRoleToken, readerToken, refusedCredentials } from '../test/tokens.js';

describe('DocumentsController (integration)', () => {
    describe('GET /documents', () => {
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

    describe('PUT and DELETE /documents', () => {
        const ID = 'work/2026-10-20-kb-write-tool/spec.md';
        const SPEC = '---\nstatus: draft\nrepos: [homelab-apps]\ncreated: 2026-10-20\n---\n\n# Writing to the knowledge base\n\nText.\n';

        let server: WritableServer;

        /** The document a refusal carries in `errors`, as the source holds it now. */
        const current = (response: SuperTest.Response): { content: string; version: string } | undefined =>
            (response.body.errors as { name: string; content: string; version: string }[]).find((error) => error.name === 'CURRENT');

        const put = async (body: object, token?: string): Promise<SuperTest.Response> => server.request
            .put('/documents')
            .set('Authorization', `Bearer ${token ?? await editorToken()}`)
            .set('On-Behalf-Of', 'akadmin')
            .send({ kb: 'dev', id: ID, ...body });

        const remove = async (body: object, token?: string): Promise<SuperTest.Response> => server.request
            .delete('/documents')
            .set('Authorization', `Bearer ${token ?? await editorToken()}`)
            .set('On-Behalf-Of', 'akadmin')
            .send({ kb: 'dev', id: ID, reason: 'Merged into another spec.', ...body });

        beforeEach(async () => {
            server = await bootstrapWritable();
        });
        afterEach(PlatformTest.reset);

        it('creates a spec without a version, and the version it answers makes the next rewrite succeed', async () => {
            expect.assertions(6);

            const created = await put({ content: SPEC, message: 'First draft.' });
            const rewritten = await put({ content: `${SPEC}More.\n`, version: created.body.version });

            expect(created.status).toBe(200);
            expect(created.body).toEqual({ id: ID, version: FakeGitHubEndpoint.blobSha(SPEC), commit: server.github.commits[0].sha });
            expect(rewritten.status).toBe(200);
            expect(server.github.files.get(ID)).toBe(`${SPEC}More.\n`);
            expect(server.github.commits[0].message).toBe('kb: Writing to the knowledge base\n\nFirst draft.\n\nOn-behalf-of: akadmin\nVia: knowledge-base MCP');
            expect(server.trigger).toHaveBeenCalledTimes(2);
        });

        it('answers 409 with the document as it is now when the version is stale, and starts no run', async () => {
            expect.assertions(4);

            const stale = server.github.seed(ID, SPEC);
            const theirs = `${SPEC}Someone else's edit.\n`;

            server.github.files.set(ID, theirs);

            const response = await put({ content: `${SPEC}Mine.\n`, version: stale });

            expect(response.status).toBe(409);
            expect(response.body).toMatchObject({
                name: 'CONFLICT',
                status: 409,
                errors: [{ name: 'CURRENT', message: 'The document as the source holds it now.', content: theirs, version: FakeGitHubEndpoint.blobSha(theirs) }]
            });
            expect(server.github.files.get(ID)).toBe(theirs);
            expect(server.trigger).not.toHaveBeenCalled();
        });

        it('tries once more when the branch moved under the write but the file is still the caller\'s version', async () => {
            expect.assertions(3);

            const version = server.github.seed(ID, SPEC);

            server.github.interfere = 1;

            const response = await put({ content: `${SPEC}Mine.\n`, version });

            expect(response.status).toBe(200);
            expect(server.github.files.get(ID)).toBe(`${SPEC}Mine.\n`);
            expect(server.github.commits).toHaveLength(1);
        });

        it('gives up after one retry, answering 409 with the document', async () => {
            expect.assertions(2);

            const version = server.github.seed(ID, SPEC);

            server.github.interfere = 2;

            const response = await put({ content: `${SPEC}Mine.\n`, version });

            expect(response.status).toBe(409);
            expect(current(response)).toMatchObject({ content: SPEC, version });
        });

        it('answers 409 with the existing document to a create of a document that exists', async () => {
            expect.assertions(2);

            const version = server.github.seed(ID, SPEC);
            const response = await put({ content: `${SPEC}Mine.\n` });

            expect(response.status).toBe(409);
            expect(current(response)).toMatchObject({ content: SPEC, version });
        });

        it('answers 409 without a current document when a create is refused twice though nothing exists', async () => {
            expect.assertions(2);

            server.github.interfere = 2;

            const response = await put({ content: SPEC });

            expect(response.status).toBe(409);
            expect(current(response)).toBeUndefined();
        });

        it('answers 404 to a rewrite or delete of a document that is gone', async () => {
            expect.assertions(2);

            const version = FakeGitHubEndpoint.blobSha(SPEC);

            expect((await put({ content: SPEC, version })).status).toBe(404);
            expect((await remove({ version })).status).toBe(404);
        });

        it('runs writes one at a time', async () => {
            expect.assertions(2);

            const responses = await Promise.all([
                put({ content: SPEC, id: 'work/2026-10-20-one/spec.md' }),
                put({ content: SPEC, id: 'work/2026-10-20-two/spec.md' }),
                put({ content: SPEC, id: 'work/2026-10-20-three/plan.md' })
            ]);

            expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
            expect(server.github.maxInFlight).toBe(1);
        });

        it.each([
            ['a raw/ note, which is append-only', { id: 'raw/2026-10-20-note.md' }, 'raw/ notes are append-only'],
            ['mirror/, which is generated', { id: 'mirror/homelab/docs/a.md' }, 'mirror/ is generated'],
            ['a folder not named YYYY-MM-DD-<slug>', { id: 'work/kb-write-tool/spec.md' }, 'work/YYYY-MM-DD-<kebab-slug>'],
            ['a folder dated a day that does not exist', { id: 'work/2026-02-30-x/spec.md' }, 'with a real date'],
            ['a file other than spec.md or plan.md', { id: 'work/2026-10-20-x/notes.md' }, 'spec.md or plan.md'],
            ['no frontmatter', { content: '# Title\n' }, 'must start with --- frontmatter'],
            ['frontmatter that does not parse', { content: '---\nrepos: [open\n---\n# T\n' }, 'does not parse'],
            ['a status outside the lifecycle', { content: SPEC.replace('draft', 'wip') }, 'status: must be one of'],
            ['repos that are not a list', { content: SPEC.replace('[homelab-apps]', 'homelab-apps') }, 'repos: must be a list'],
            ['a created that is not a date', { content: SPEC.replace('2026-10-20', 'yesterday') }, 'created: must be a YYYY-MM-DD date'],
            ['no title line', { content: SPEC.replace('# Writing', 'Writing') }, 'needs a "# " title line'],
            ['a secret in the document', { content: `${SPEC}\n${['-----BEGIN RSA', 'PRIVATE KEY-----'].join(' ')}\n` }, 'holds a private key'],
            ['a secret in the message', { content: SPEC, message: `password: ${['hunter', '2hunter2'].join('')}` }, 'holds a secret with its value']
        ])('refuses %s with 400, and commits nothing', async (_case, body, message) => {
            expect.assertions(3);

            const response = await put({ content: SPEC, ...body });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain(message);
            expect(server.github.commits).toEqual([]);
        });

        it('deletes a document at its version, the reason in the commit', async () => {
            expect.assertions(4);

            const version = server.github.seed(ID, SPEC);
            const response = await remove({ version });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ id: ID, commit: server.github.commits[0].sha });
            expect(server.github.files.has(ID)).toBe(false);
            expect(server.github.commits[0].message).toBe(
                `kb: delete ${ID}\n\nOn-behalf-of: akadmin\nVia: knowledge-base MCP\nReason: Merged into another spec.`
            );
        });

        it('deletes a raw/ note, and answers 409 with the current document to a delete at a stale version', async () => {
            expect.assertions(3);

            const note = 'raw/2026-10-20-mistake.md';
            const stale = server.github.seed(note, '# Old\n');

            server.github.files.set(note, '# New\n');

            const refused = await remove({ id: note, version: stale });
            const deleted = await remove({ id: note, version: current(refused)!.version });

            expect(refused.status).toBe(409);
            expect(current(refused)!.content).toBe('# New\n');
            expect(deleted.status).toBe(200);
        });

        it.each([
            ['mirror/', 'mirror/homelab/docs/a.md', 'mirror/ is generated'],
            ['a path outside raw/ and work/', 'README.md', 'Only a raw/ note']
        ])('refuses to delete %s', async (_case, id, message) => {
            expect.assertions(3);

            server.github.seed(id, '# A\n');

            const response = await remove({ id, version: FakeGitHubEndpoint.blobSha('# A\n') });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain(message);
            expect(server.github.files.has(id)).toBe(true);
        });

        it('is refused to a reader: editor is required on top of the reader floor', async () => {
            expect.assertions(3);

            const version = server.github.seed(ID, SPEC);
            const token = await readerToken();

            expect((await put({ content: SPEC, version }, token)).status).toBe(403);
            expect((await remove({ version }, token)).status).toBe(403);
            expect(server.github.commits).toEqual([]);
        });

        it('answers 404 for a knowledge base the caller cannot read', async () => {
            expect.assertions(1);

            expect((await put({ content: SPEC, kb: 'home' })).status).toBe(404);
        });
    });

    describe('on a source that cannot be written', () => {
        let request: SuperTest.Agent;

        beforeEach(async () => {
            ({ request } = await bootstrapIndexed());
        });
        afterEach(PlatformTest.reset);

        it('answers 501 to a write', async () => {
            expect.assertions(2);

            const response = await request
                .put('/documents')
                .set('Authorization', `Bearer ${await editorToken()}`)
                .set('On-Behalf-Of', 'akadmin')
                .send({ kb: 'dev', id: 'work/2026-10-20-x/spec.md', content: '---\nstatus: draft\nrepos: []\ncreated: 2026-10-20\n---\n# X\n' });

            expect(response.status).toBe(501);
            expect(response.body.message).toBe('Knowledge base dev has a GIT source, which cannot be written.');
        });
    });
});
