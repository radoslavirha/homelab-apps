import { CircuitState, HealthCheckService } from '@radoslavirha/tsed-health';
import { HttpProviderService } from '@radoslavirha/tsed-http-provider';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaEndpoint } from './endpoints/ollama/OllamaEndpoint.js';
import { ExternalApi } from './models/config/ExternalApi.enum.js';
import { Server } from './Server.js';
import { PostgresService } from './storage/postgres/PostgresService.js';
import { ROLE_ADMIN, ROLE_EDITOR, ROLE_READER } from './models/Roles.js';
import { bootstrapWritable, type WritableServer } from './test/bootstrapWritable.js';
import { FakeOllamaEndpoint } from './test/FakeOllamaEndpoint.js';
import { UNAUTHENTICATED_SUBJECT, UNAUTHENTICATED_SUBJECT_HEADER, unauthenticatedAuth } from './test/unauthenticatedAuth.js';

const NOTE = {
    kb: 'development',
    title: 'Developers write without an IdP',
    type: 'DECISION',
    context: 'The API runs on a VPN with no identity provider.',
    decisionOrFact: 'The IDP entry is unauthenticated.',
    alternativesRejected: ['An IdP of its own: nobody to run it.'],
    howToApply: 'Keep it on a trusted network.',
    links: [],
    repos: ['homelab-apps'],
    date: '2026-11-06'
};

describe('Server', () => {
    let request: SuperTest.Agent;

    beforeEach(PlatformTest.bootstrap(Server, { imports: [{ token: OllamaEndpoint, use: new FakeOllamaEndpoint() }] }));
    beforeEach(() => {
        request = SuperTest.agent(PlatformTest.callback());
    });
    afterEach(PlatformTest.reset);
    afterEach(vi.restoreAllMocks);

    it('answers 404 for an unknown route', async () => {
        expect.assertions(1);

        expect((await request.get('/rest')).status).toBe(404);
    });

    describe('health', () => {
        it('registers exactly the expected checks, and only the database as critical', () => {
            const checks = PlatformTest.get<HealthCheckService>(HealthCheckService).checks();

            expect(checks.map((check) => [check.name, check.critical])).toEqual([
                ['postgres', true],
                ['upstream-apis', false]
            ]);
        });

        it('is ready with a reachable database', async () => {
            expect.assertions(2);

            const response = await request.get('/health');

            expect(response.status).toBe(200);

            expect(response.body).toEqual({ status: 'pass', checks: { 'postgres': { status: 'pass' }, 'upstream-apis': { status: 'pass' } } });
        });

        it('stays ready, and warns, while the Ollama circuit is open — search still answers from full-text', async () => {
            expect.assertions(3);

            const http = PlatformTest.get<HttpProviderService<ExternalApi>>(HttpProviderService);

            vi.spyOn(http, 'breakers').mockReturnValue(new Map([[ExternalApi.Ollama, { state: CircuitState.Open }]]));

            expect((await request.get('/health/ready')).status).toBe(200);

            const response = await request.get('/health');

            expect(response.status).toBe(200);

            expect(response.body.checks['upstream-apis']).toEqual({ status: 'warn', detail: 'degraded: OLLAMA' });
        });

        it('fails readiness, without saying why in detail, when the database is gone', async () => {
            expect.assertions(2);

            const postgres = PlatformTest.get<PostgresService>(PostgresService);

            await postgres.$onDestroy();

            const response = await request.get('/health/ready');

            expect(response.status).toBe(503);

            expect(response.body).toEqual({ status: 'fail' });
        });
    });

    describe('schema', () => {
        it('creates the tables and one HNSW index per configured model', async () => {
            expect.assertions(4);

            const postgres = PlatformTest.get<PostgresService>(PostgresService);
            const tables = await postgres.query<{ tablename: string }>(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
            );
            const indexes = await postgres.query<{ indexdef: string }>(
                "SELECT indexdef FROM pg_indexes WHERE tablename = 'embeddings' AND indexdef LIKE '%hnsw%'"
            );

            expect(tables.rows.map((row) => row.tablename)).toEqual(['chunks', 'documents', 'embeddings', 'knowledge_bases', 'pgmigrations']);
            expect(indexes.rows).toHaveLength(1);
            expect(indexes.rows[0].indexdef).toContain("WHERE (model = 'test-embed:v1'::text)");
            expect(indexes.rows[0].indexdef).toContain('vector(4)');
        });

        it('writes a row for every configured knowledge base', async () => {
            expect.assertions(1);

            const { rows } = await PlatformTest.get<PostgresService>(PostgresService)
                .query<{ id: string; source: string; ts_config: string }>('SELECT id, source, ts_config::text FROM knowledge_bases');

            expect(rows).toEqual([{ id: 'development', source: 'GIT', ts_config: 'english' }]);
        });
    });
});

describe('Server — under an unauthenticated IDP entry', () => {
    let server: WritableServer;

    afterEach(PlatformTest.reset);

    describe('granting reader, editor and admin', () => {
        beforeEach(async () => {
            server = await bootstrapWritable([unauthenticatedAuth([ROLE_READER, ROLE_EDITOR, ROLE_ADMIN])]);
        });

        it('answers GET /search and GET /status with no Authorization header', async () => {
            expect.assertions(3);

            const search = await server.request.get('/search').query({ q: 'anything' });
            const status = await server.request.get('/status');

            expect(search.status).toBe(200);
            expect(status.status).toBe(200);
            // The KB's readers check runs on the configured roles.
            expect(status.body.knowledgeBases.map((kb: { id: string }) => kb.id)).toEqual(['development']);
        });

        it('ignores an Authorization header rather than refusing it', async () => {
            expect.assertions(1);

            expect((await server.request.get('/status').set('Authorization', 'Bearer not-a-jwt')).status).toBe(200);
        });

        it('writes for the On-Behalf-Of the caller sends, as the MCP does', async () => {
            expect.assertions(2);

            const response = await server.request.post('/notes').set('On-Behalf-Of', 'akadmin').send(NOTE);

            expect(response.status).toBe(201);
            expect(server.github.commits[0].message).toContain('On-behalf-of: akadmin');
        });

        it('writes for the caller\'s own subject when On-Behalf-Of is absent', async () => {
            expect.assertions(3);

            const response = await server.request.post('/notes').send(NOTE);

            expect(response.status).toBe(201);
            expect(server.github.commits[0].message).toContain(`On-behalf-of: ${UNAUTHENTICATED_SUBJECT}`);
            expect(server.github.files.get(response.body.id)).toContain(`author: ${UNAUTHENTICATED_SUBJECT}`);
        });

        it('takes the subject from the unverified label header when one is sent', async () => {
            expect.assertions(2);

            const response = await server.request.delete('/documents')
                .set(UNAUTHENTICATED_SUBJECT_HEADER, 'jane.doe')
                .send({ kb: 'development', id: 'raw/2026-01-01-old.md', version: server.github.seed('raw/2026-01-01-old.md', '# Old\n'), reason: 'Superseded.' });

            expect(response.status).toBe(200);
            expect(server.github.commits[0].message).toContain('On-behalf-of: jane.doe');
        });

        it('still refuses a malformed On-Behalf-Of rather than falling back', async () => {
            expect.assertions(2);

            expect((await server.request.post('/notes').set('On-Behalf-Of', 'a b').send(NOTE)).status).toBe(400);
            expect(server.github.commits).toEqual([]);
        });

        it('starts POST /reindex: admin is one of the configured roles', async () => {
            expect.assertions(1);

            expect((await server.request.post('/reindex')).status).toBe(202);
        });
    });

    describe('granting reader and editor, not admin', () => {
        beforeEach(async () => {
            server = await bootstrapWritable([unauthenticatedAuth([ROLE_READER, ROLE_EDITOR])]);
        });

        it('answers 403 on POST /reindex and starts nothing, while reads still work', async () => {
            expect.assertions(3);

            expect((await server.request.post('/reindex')).status).toBe(403);
            expect(server.trigger).not.toHaveBeenCalled();
            expect((await server.request.get('/status')).status).toBe(200);
        });
    });

    describe('granting reader only', () => {
        beforeEach(async () => {
            server = await bootstrapWritable([unauthenticatedAuth([ROLE_READER])]);
        });

        it('answers 403 on a write and commits nothing', async () => {
            expect.assertions(2);

            expect((await server.request.post('/notes').send(NOTE)).status).toBe(403);
            expect(server.github.commits).toEqual([]);
        });
    });
});
