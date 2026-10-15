import { mintTestToken } from '@radoslavirha/tsed-auth';
import { PlatformTest } from '@tsed/platform-http/testing';
import type SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROLE_ADMIN } from '../models/Roles.js';
import { SearchMode } from '../models/SearchMode.enum.js';
import { bootstrapIndexed } from '../test/bootstrapIndexed.js';
import type { FakeOllamaEndpoint } from '../test/FakeOllamaEndpoint.js';
import { noRoleToken, readerToken } from '../test/tokens.js';

interface Result {
    externalId: string;
    anchor: string;
    snippet: string;
    heading: string;
    metadata: Record<string, unknown>;
}

describe('SearchController (integration)', () => {
    let request: SuperTest.Agent;
    let ollama: FakeOllamaEndpoint;

    /** Resolves to the response — awaiting a supertest request is what sends it. */
    const search = async (query: Record<string, string | number>, token?: string): Promise<SuperTest.Response> =>
        request.get('/search').query(query).set('Authorization', `Bearer ${token ?? await readerToken()}`);
    const ids = (body: { results: Result[] }): string[] => body.results.map((result) => result.externalId);

    beforeEach(async () => {
        ({ request, ollama } = await bootstrapIndexed());
    });
    afterEach(PlatformTest.reset);

    describe('auth', () => {
        it('refuses a request without a credential', async () => {
            expect.assertions(1);

            expect((await request.get('/search').query({ q: 'pods' })).status).toBe(401);
        });

        it('refuses a valid token without the reader role with 403, not 401', async () => {
            expect.assertions(1);

            expect((await search({ q: 'pods' }, await noRoleToken())).status).toBe(403);
        });

        it('refuses an admin token that lacks the reader floor', async () => {
            expect.assertions(1);

            expect((await search({ q: 'pods' }, await mintTestToken({ claims: { roles: [ROLE_ADMIN] } }))).status).toBe(403);
        });

        it('refuses a forged token', async () => {
            expect.assertions(1);

            const forged = await mintTestToken({ secret: 'another-secret-not-real-0000000000', claims: { roles: ['knowledge-base-api.reader'] } });

            expect((await search({ q: 'pods' }, forged)).status).toBe(401);
        });
    });

    describe('vector (the default)', () => {
        it('ranks the section that answers the question first, with its anchor, snippet and metadata', async () => {
            expect.assertions(6);

            const response = await search({ q: 'Why does a pod keep the old environment after a ConfigMap edit?' });

            expect(response.status).toBe(200);

            expect(response.body.mode).toBe(SearchMode.Vector);
            expect(response.body.models).toEqual(['test-embed:v1']);
            expect(response.body.results[0]).toMatchObject({
                kb: 'dev',
                externalId: 'raw/2026-01-01-configmap-env-restart.md',
                anchor: 'raw/2026-01-01-configmap-env-restart.md#fact',
                title: 'ConfigMap envFrom changes don\'t restart pods',
                heading: 'Fact',
                date: '2026-01-01',
                metadata: { area: 'raw', type: 'gotcha', repos: ['homelab'] }
            });
            expect(response.body.results[0].snippet).toContain('**');
            expect(response.body.results[0].score).toBeGreaterThan(0);
        });

        it('finds by meaning a section that shares no word with the question', async () => {
            expect.assertions(2);

            // "env" stems to nothing in the corpus; only the vector leg can match it.
            const response = await search({ q: 'env' });

            expect(response.status).toBe(200);

            expect(ids(response.body)[0]).toBe('raw/2026-01-01-configmap-env-restart.md');
        });

        it('sends the question through the model\'s query template', async () => {
            expect.assertions(2);

            expect((await search({ q: 'traefik probes' })).status).toBe(200);

            expect(ollama.requests.at(-1)?.input).toEqual(['task: search result | query: traefik probes']);
        });
    });

    describe('hybrid', () => {
        it('fuses the full-text leg in when it is weighted for the request', async () => {
            expect.assertions(3);

            const response = await search({ q: 'Why does a pod keep the old environment after a ConfigMap edit?', fullTextWeight: 1 });

            expect(response.status).toBe(200);
            expect(response.body.mode).toBe(SearchMode.Hybrid);
            expect(ids(response.body)[0]).toBe('raw/2026-01-01-configmap-env-restart.md');
        });

        it('answers from full-text alone when the vector leg is weighted out', async () => {
            expect.assertions(2);

            const response = await search({ q: 'traefik probes', vectorWeight: 0, fullTextWeight: 1 });

            expect(response.body.mode).toBe(SearchMode.FullText);
            expect(ids(response.body)[0]).toBe('raw/2026-01-02-traefik-probe-port.md');
        });
    });

    describe('when the embedder is down', () => {
        it('answers from full-text and says so', async () => {
            expect.assertions(4);

            ollama.failing = true;

            const response = await search({ q: 'Why does a pod keep the old environment after a ConfigMap edit?' });

            expect(response.status).toBe(200);

            expect(response.body.mode).toBe(SearchMode.FullText);
            expect(response.body.models).toEqual([]);
            expect(ids(response.body)[0]).toBe('raw/2026-01-01-configmap-env-restart.md');
        });
    });

    describe('ranking', () => {
        it('ranks an abandoned spec and a superseded note last, but still returns them', async () => {
            expect.assertions(3);

            const response = await search({ q: 'Where do Longhorn backups go? dumps' });

            expect(response.status).toBe(200);
            const found = ids(response.body);
            const demoted = ['work/2026-01-04-volume-backup-target/spec.md', 'raw/2026-01-05-backups-to-r2.md'];

            expect(found).toEqual(expect.arrayContaining(demoted));
            expect(found.slice(-2).sort()).toEqual([...demoted].sort());
        });

        it('returns at most limit results', async () => {
            expect.assertions(2);

            const response = await search({ q: 'backup', limit: 1 });

            expect(response.status).toBe(200);

            expect(response.body.results).toHaveLength(1);
        });
    });

    describe('filters', () => {
        it('narrows by a scalar metadata field', async () => {
            expect.assertions(3);

            const response = await search({ q: 'backup longhorn', filter: 'area:work' });

            expect(response.status).toBe(200);

            expect(ids(response.body).every((id) => id.startsWith('work/'))).toBe(true);
            expect(response.body.results.length).toBeGreaterThan(0);
        });

        it('matches a value inside an array field', async () => {
            expect.assertions(2);

            const response = await search({ q: 'apps', filter: 'repos:homelab-apps' });

            expect(response.status).toBe(200);

            expect(ids(response.body)).toEqual(['mirror/homelab-apps/README.md']);
        });

        it('rejects a malformed filter', async () => {
            expect.assertions(1);

            expect((await search({ q: 'x', filter: 'area' })).status).toBe(400);
        });
    });

    describe('knowledge bases', () => {
        it('answers 404 for a knowledge base the caller cannot read, the same as for one that does not exist', async () => {
            expect.assertions(1);

            expect((await search({ q: 'pods', kb: 'home' })).status).toBe(404);
        });

        it('searches a named, readable knowledge base', async () => {
            expect.assertions(1);

            expect((await search({ q: 'pods', kb: 'dev' })).status).toBe(200);
        });
    });

    describe('validation', () => {
        it('rejects a model no searched knowledge base is embedded with', async () => {
            expect.assertions(1);

            expect((await search({ q: 'x', model: 'other:1b' })).status).toBe(400);
        });
    });
});
