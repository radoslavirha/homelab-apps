import { CircuitState, HealthCheckService } from '@radoslavirha/tsed-health';
import { HttpProviderService } from '@radoslavirha/tsed-http-provider';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaEndpoint } from './endpoints/ollama/OllamaEndpoint.js';
import { ExternalApi } from './models/config/ExternalApi.enum.js';
import { Server } from './Server.js';
import { PostgresService } from './storage/postgres/PostgresService.js';
import { FakeOllamaEndpoint } from './test/FakeOllamaEndpoint.js';

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

            expect(rows).toEqual([{ id: 'dev', source: 'GIT', ts_config: 'english' }]);
        });
    });
});
