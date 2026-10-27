import { PlatformTest } from '@tsed/platform-http/testing';
import type SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapWritable, type WritableServer } from '../test/bootstrapWritable.js';
import { FakeGitHubEndpoint } from '../test/FakeGitHubEndpoint.js';
import { editorToken, readerToken } from '../test/tokens.js';

const DECISION = {
    kb: 'dev',
    title: 'MongoDB stays on :latest',
    type: 'DECISION',
    context: 'Renovate kept proposing a digest pin.',
    decisionOrFact: 'The image stays on :latest.',
    alternativesRejected: ['A digest pin — every bump is a manual PR.'],
    howToApply: 'Do not pin it.',
    links: ['homelab:apps/mongodb/values.yaml'],
    repos: ['homelab'],
    date: '2026-10-20'
};

const ID = 'raw/2026-10-20-mongodb-stays-on-latest.md';

describe('NotesController (integration)', () => {
    let server: WritableServer;

    const post = async (body: object, token?: string): Promise<SuperTest.Response> => server.request
        .post('/notes')
        .set('Authorization', `Bearer ${token ?? await editorToken()}`)
        .set('On-Behalf-Of', 'akadmin')
        .send(body);

    beforeEach(async () => {
        server = await bootstrapWritable();
    });
    afterEach(PlatformTest.reset);

    it('renders the note, commits it in one call with the provenance trailers, and starts an indexing run', async () => {
        expect.assertions(6);

        const response = await post(DECISION);
        const content = server.github.files.get(ID)!;

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ id: ID, version: FakeGitHubEndpoint.blobSha(content), commit: server.github.commits[0].sha });
        expect(content).toBe([
            '---',
            'date: 2026-10-20',
            'type: decision',
            'repos: [homelab]',
            'source: chat',
            'author: akadmin',
            '---',
            '',
            '# MongoDB stays on :latest',
            '',
            '## Context',
            'Renovate kept proposing a digest pin.',
            '',
            '## Decision',
            'The image stays on :latest.',
            '',
            '## Alternatives rejected',
            '- A digest pin — every bump is a manual PR.',
            '',
            '## How to apply',
            'Do not pin it.',
            '',
            '## Links',
            '- homelab:apps/mongodb/values.yaml',
            ''
        ].join('\n'));
        expect(server.github.commits[0]).toMatchObject({
            branch: 'main',
            message: 'kb: MongoDB stays on :latest\n\nOn-behalf-of: akadmin\nVia: knowledge-base MCP'
        });
        expect(server.trigger).toHaveBeenCalledTimes(1);
        expect(server.trigger).toHaveBeenCalledWith({ knowledgeBases: ['dev'], full: false, manual: false });
    });

    it('answers 409 with the note as committed in errors when the create is retried after it landed', async () => {
        expect.assertions(3);

        const first = await post(DECISION);
        const retry = await post(DECISION);

        expect(retry.status).toBe(409);
        expect(retry.body.errors).toEqual([expect.objectContaining({ name: 'CURRENT', content: server.github.files.get(ID), version: first.body.version })]);
        expect(server.github.commits).toHaveLength(1);
    });

    it('refuses a decision without the alternatives it rejected, and commits nothing', async () => {
        expect.assertions(3);

        const response = await post({ ...DECISION, alternativesRejected: [' '] });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('a DECISION needs alternativesRejected');
        expect(server.github.commits).toEqual([]);
    });

    it('refuses a note that holds a secret, without repeating it', async () => {
        expect.assertions(4);

        const secret = ['Zq8vK2mXr9Tb', 'L4wPn7YsH3dF'].join('');
        const response = await post({ ...DECISION, howToApply: `Log in with ${secret}.` });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('looks like it holds a high-entropy string');
        expect(response.body.message).not.toContain(secret);
        expect(server.github.commits).toEqual([]);
    });

    it('takes supersedes only when the note it names exists', async () => {
        expect.assertions(3);

        const missing = await post({ ...DECISION, supersedes: 'raw/2026-09-06-old.md' });

        server.github.seed('raw/2026-09-06-old.md', '---\ndate: 2026-09-06\n---\n# Old\n');

        const found = await post({ ...DECISION, supersedes: 'raw/2026-09-06-old.md' });

        expect(missing.status).toBe(400);
        expect(found.status).toBe(201);
        expect(server.github.files.get(ID)).toContain('\nsupersedes: raw/2026-09-06-old.md\n');
    });

    it('is refused to a reader: editor is required on top of the reader floor', async () => {
        expect.assertions(2);

        expect((await post(DECISION, await readerToken())).status).toBe(403);
        expect(server.github.commits).toEqual([]);
    });

    it('needs the username it writes for, as a username', async () => {
        expect.assertions(3);

        const token = await editorToken();
        const without = await server.request.post('/notes').set('Authorization', `Bearer ${token}`).send(DECISION);
        const forged = await server.request.post('/notes').set('Authorization', `Bearer ${token}`).set('On-Behalf-Of', 'a b').send(DECISION);

        expect(without.status).toBe(400);
        expect(forged.status).toBe(400);
        expect(server.github.commits).toEqual([]);
    });
});
