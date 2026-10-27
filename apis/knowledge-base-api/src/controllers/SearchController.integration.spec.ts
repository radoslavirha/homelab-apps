import { mintTestToken } from '@radoslavirha/tsed-auth';
import { Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import type SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_ADMIN, ROLE_READER } from '../models/Roles.js';
import { SearchMode } from '../models/SearchMode.enum.js';
import { bootstrapIndexed } from '../test/bootstrapIndexed.js';
import type { FakeOllamaEndpoint } from '../test/FakeOllamaEndpoint.js';
import { FOREIGN_AUDIENCE, noRoleToken, readerToken, refusedCredentials } from '../test/tokens.js';

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

        it('refuses a forged, foreign, expired or non-bearer credential with 401, saying nothing about why', async () => {
            const credentials = await refusedCredentials();

            expect.assertions(credentials.length * 2);

            for (const [reason, authorization] of credentials) {
                const response = await request.get('/search').query({ q: 'pods' }).set('Authorization', authorization);

                expect(response.status, reason).toBe(401);
                expect(JSON.stringify(response.body), reason).not.toContain(FOREIGN_AUDIENCE);
            }
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
                kb: 'development',
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

            expect((await search({ q: 'pods', kb: 'development' })).status).toBe(200);
        });
    });

    describe('validation', () => {
        it('rejects a model no searched knowledge base is embedded with', async () => {
            expect.assertions(1);

            expect((await search({ q: 'x', model: 'other:1b' })).status).toBe(400);
        });
    });

    describe('request log', () => {
        type LogRecord = Record<string, unknown>;

        let written: LogRecord[];

        /**
         * The request line for `url`, as the shared Winston instance received it — after the
         * `metaProvider` fields are merged in. Polled: Ts.ED writes it on the response's `finish`,
         * which can land after supertest has the response.
         */
        const requestLine = async (url: string): Promise<LogRecord> =>
            vi.waitFor(() => {
                const line = written.find((record) => record.scope === 'HTTP_REQUEST' && record.url === url);

                if (CommonUtils.isUndefined(line)) {
                    throw new Error(`No request line for ${url} yet.`);
                }

                return line;
            });

        beforeEach(() => {
            written = [];
            const winston = (PlatformTest.get<Logger>(Logger) as unknown as { logger: { log: (record: LogRecord) => unknown } }).logger;

            vi.spyOn(winston, 'log').mockImplementation((record: LogRecord) => written.push(record));
        });
        afterEach(() => vi.restoreAllMocks());

        it('names the caller and keeps the query, but carries no body and no credential', async () => {
            expect.assertions(8);

            const token = await mintTestToken({ subject: 'ak-development-kb-mcp-client_credentials', claims: { roles: [ROLE_READER] } });
            const response = await search({ q: 'Why does a pod keep the old environment after a ConfigMap edit?' }, token);
            const line = await requestLine('/search');

            expect(response.body.results[0].snippet).not.toHaveLength(0);
            expect(line).toMatchObject({
                message: 'Request completed',
                method: 'GET',
                status: 200,
                duration: expect.any(Number),
                principalSubject: 'ak-development-kb-mcp-client_credentials',
                principalKind: 'human',
                principalIssuer: 'https://issuer.test/'
            });
            expect(line.query).toContain('ConfigMap edit');
            expect(line).not.toHaveProperty('response');
            expect(line).not.toHaveProperty('request');
            expect(JSON.stringify(line)).not.toContain(response.body.results[0].snippet);
            expect(JSON.stringify(line)).not.toContain(token);
            expect(line.headers).toContain('"authorization":"***"');
        });

        it('names nobody on a refused credential, and does not log it', async () => {
            expect.assertions(3);

            const [, authorization] = (await refusedCredentials())[0];

            await request.get('/search').query({ q: 'pods' }).set('Authorization', authorization);
            const line = await requestLine('/search');

            expect(line).toMatchObject({ message: 'Request failed', status: 401 });
            expect(Object.keys(line).filter((key) => key.startsWith('principal'))).toEqual([]);
            expect(JSON.stringify(line)).not.toContain(authorization.replace('Bearer ', ''));
        });
    });
});
