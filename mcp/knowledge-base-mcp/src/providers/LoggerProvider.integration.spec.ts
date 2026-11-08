import { BaseLogger, LogLevel } from '@radoslavirha/tsed-logger';
import { ObjectUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { toMcpSettings } from '../mcp/toMcpSettings.js';
import { Server } from '../Server.js';
import { TEST_PUBLIC_URL, TEST_SERVERS, userToken } from '../test/fixtures.js';
import * as tools from '../tools/index.js';

const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
const INITIALIZE = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-client', version: '1.0.0' } } };

describe('LoggerProvider (integration)', () => {
    let request: SuperTest.Agent;
    let log: MockInstance<BaseLogger['log']>;

    /** The levels the request log wrote its one line for the last response at. */
    const requestLogLevels = (): unknown[] => log.mock.calls
        .filter(([, body]) => body === 'Request failed' || body === 'Request completed')
        .map(([level]) => level);

    beforeEach(PlatformTest.bootstrap(Server, {
        mcp: toMcpSettings({ publicURL: TEST_PUBLIC_URL, mcpServers: TEST_SERVERS }, { version: '9.9.9' }, ObjectUtils.values(tools))
    }));
    beforeEach(() => {
        request = SuperTest.agent(PlatformTest.callback());
        log = vi.spyOn(BaseLogger.prototype, 'log');
    });
    afterEach(PlatformTest.reset);
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs the discovery 401 below error, with the request log\'s fields', async () => {
        expect.assertions(3);

        const response = await request.post('/development').set(MCP_HEADERS).send(INITIALIZE).expect(401);

        expect(response.headers['www-authenticate']).toContain('resource_metadata=');
        expect(requestLogLevels()).toEqual([LogLevel.INFO]);
        expect(log).toHaveBeenCalledWith(LogLevel.INFO, 'Request failed', expect.objectContaining({
            method: 'POST',
            url: '/development',
            status: 401,
            duration: expect.any(Number),
            reqId: expect.any(String),
            headers: expect.any(String)
        }));
    });

    it('keeps a 404 at error', async () => {
        expect.assertions(1);

        await request.get('/nothing-here').expect(404);

        expect(requestLogLevels()).toEqual([LogLevel.ERROR]);
    });

    it('keeps a 403 at error, though it carries a challenge too', async () => {
        expect.assertions(2);

        const response = await request.post('/development').set(MCP_HEADERS).set('Authorization', `Bearer ${await userToken({ claims: { roles: [] } })}`).send(INITIALIZE).expect(403);

        expect(response.headers['www-authenticate']).toContain('insufficient_scope');
        expect(requestLogLevels()).toEqual([LogLevel.ERROR]);
    });
});
