import { CircuitState, HealthCheckService, ShutdownState } from '@radoslavirha/tsed-health';
import { HttpProviderService } from '@radoslavirha/tsed-http-provider';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalApi } from './models/config/ExternalApi.enum.js';
import { toMcpSettings } from './mcp/toMcpSettings.js';
import { Server } from './Server.js';
import { TEST_PUBLIC_URL, TEST_SERVER, userToken } from './test/fixtures.js';

/** What a Streamable HTTP client sends: it must accept both a JSON answer and an event stream. */
const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };

/** The endpoint as index.ts builds it, from fixed values instead of ConfigService. */
const MCP = toMcpSettings(
    { publicURL: TEST_PUBLIC_URL, mcpServers: { DEVELOPMENT_KB: TEST_SERVER } },
    { description: 'Test description', version: '9.9.9' },
    []
);

describe('Server (integration)', () => {
    let request: SuperTest.Agent;   // anonymous
    let api: SuperTest.Agent;       // a caller holding the endpoint's role

    beforeEach(PlatformTest.bootstrap(Server, { mcp: MCP }));
    beforeEach(async () => {
        request = SuperTest.agent(PlatformTest.callback());
        api = SuperTest.agent(PlatformTest.callback()).set('Authorization', `Bearer ${await userToken()}`);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('MCP endpoint', () => {
        it('answers initialize at its path with its name, version and the latest protocol version', async () => {
            expect.assertions(3);

            const response = await api.post('/development').set(MCP_HEADERS).send({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-client', version: '1.0.0' } }
            });

            expect(response.status).toBe(200);
            expect(response.body.result.protocolVersion).toBe('2025-11-25');
            expect(response.body.result.serverInfo).toMatchObject({ name: 'test-server', title: 'Test title', description: 'Test description', version: '9.9.9' });
        });

        it('answers an older client in its own protocol version', async () => {
            expect.assertions(1);

            const response = await api.post('/development').set(MCP_HEADERS).send({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'old-client', version: '1.0.0' } }
            });

            expect(response.body.result.protocolVersion).toBe('2025-03-26');
        });

        it('opens no event stream and keeps no session: GET and DELETE are 405', async () => {
            expect.assertions(3);

            const get = await request.get('/development').set(MCP_HEADERS);

            expect(get.status).toBe(405);
            expect(get.headers.allow).toBe('POST');
            expect((await request.delete('/development').set(MCP_HEADERS)).status).toBe(405);
        });
    });

    describe('health', () => {
        it('registers the upstream check, non-critical', () => {
            expect(PlatformTest.get<HealthCheckService>(HealthCheckService).checks().map((c) => [c.name, c.critical])).toEqual([['upstream-apis', false]]);
        });

        it('reports knowledge-base-api degraded while its circuit breaker is open, and stays ready', async () => {
            expect.assertions(3);

            vi.spyOn(PlatformTest.get<HttpProviderService<ExternalApi>>(HttpProviderService), 'breakers')
                .mockReturnValue(new Map([[ExternalApi.KnowledgeBaseApi, { state: CircuitState.Open }]]) as never);

            const response = await request.get('/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('warn');
            expect((await request.get('/health/ready')).status).toBe(200);
        });

        it('answers liveness', async () => {
            expect.assertions(2);

            const response = await request.get('/health/live');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ status: 'pass' });
        });

        it('answers readiness', async () => {
            expect.assertions(2);

            const response = await request.get('/health/ready');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ status: 'pass' });
        });

        it('answers the full report as application/health+json', async () => {
            expect.assertions(3);

            const response = await request.get('/health');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('application/health+json');
            expect(response.body.status).toBe('pass');
        });

        it('stops being ready while draining, and stays live', async () => {
            expect.assertions(2);

            vi.spyOn(PlatformTest.get<ShutdownState>(ShutdownState), 'draining', 'get').mockReturnValue(true);

            expect((await request.get('/health/ready')).status).toBe(503);
            expect((await request.get('/health/live')).status).toBe(200);
        });
    });

    it('serves nothing else, the root included', async () => {
        expect.assertions(2);

        expect((await request.get('/anything-else')).status).toBe(404);
        expect((await request.post('/').set(MCP_HEADERS).send({ jsonrpc: '2.0', id: 1, method: 'ping' })).status).toBe(404);
    });
});
