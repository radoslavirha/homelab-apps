import { HealthCheckService, ShutdownState } from '@radoslavirha/tsed-health';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from './Server.js';

/** What a Streamable HTTP client sends: it must accept both a JSON answer and an event stream. */
const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };

describe('Server (integration)', () => {
    let request: SuperTest.Agent;

    // index.ts sets `mcp` from ConfigService; the bootstrap is not under test, so the same shape
    // is passed here with fixed values.
    beforeEach(PlatformTest.bootstrap(Server, {
        mcp: { path: '/', name: 'test-server', title: 'Test title', version: '9.9.9' }
    }));
    beforeEach(() => {
        request = SuperTest.agent(PlatformTest.callback());
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('MCP endpoint', () => {
        it('answers initialize at the root with its name, version and the latest protocol version', async () => {
            expect.assertions(3);

            const response = await request.post('/').set(MCP_HEADERS).send({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-client', version: '1.0.0' } }
            });

            expect(response.status).toBe(200);
            expect(response.body.result.protocolVersion).toBe('2025-11-25');
            expect(response.body.result.serverInfo).toMatchObject({ name: 'test-server', title: 'Test title', version: '9.9.9' });
        });

        it('answers an older client in its own protocol version', async () => {
            expect.assertions(1);

            const response = await request.post('/').set(MCP_HEADERS).send({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'old-client', version: '1.0.0' } }
            });

            expect(response.body.result.protocolVersion).toBe('2025-03-26');
        });

        it('opens no event stream and keeps no session: GET and DELETE are 405', async () => {
            expect.assertions(3);

            const get = await request.get('/').set(MCP_HEADERS);

            expect(get.status).toBe(405);
            expect(get.headers.allow).toBe('POST');
            expect((await request.delete('/').set(MCP_HEADERS)).status).toBe(405);
        });
    });

    describe('health', () => {
        it('registers no check yet: nothing it depends on exists', () => {
            expect(PlatformTest.get<HealthCheckService>(HealthCheckService).checks()).toEqual([]);
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

    it('serves nothing else', async () => {
        expect.assertions(1);

        expect((await request.get('/anything-else')).status).toBe(404);
    });
});
