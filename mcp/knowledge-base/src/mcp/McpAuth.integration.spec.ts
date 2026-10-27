import { createServer, type IncomingHttpHeaders, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ObjectUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from '../Server.js';
import { ConfigService } from '../services/ConfigService.js';
import { TEST_PUBLIC_URL, TEST_SERVER, userToken } from '../test/fixtures.js';
import * as tools from '../tools/index.js';
import { toMcpSettings } from './toMcpSettings.js';

const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
const INITIALIZE = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-client', version: '1.0.0' } } };
const METADATA_PATH = '/.well-known/oauth-protected-resource/development';

describe('MCP endpoint auth (integration)', () => {
    /** Every request knowledge-base-api and Authentik's token endpoint received, headers and body. */
    const upstream: { headers: IncomingHttpHeaders; body: string }[] = [];
    let fake: HttpServer;
    let request: SuperTest.Agent;

    const post = (token?: string): SuperTest.Test => {
        const call = request.post('/development').set(MCP_HEADERS);

        return token === undefined ? call.send(INITIALIZE) : call.set('Authorization', `Bearer ${token}`).send(INITIALIZE);
    };

    // A fake Authentik token endpoint and knowledge-base-api, as KnowledgeBaseApiEndpoint's own
    // integration spec plays them, pointed at before the HTTP client is built.
    beforeAll(async () => {
        fake = createServer((incoming, response) => {
            let body = '';

            incoming.on('data', (part: Buffer) => {
                body += part.toString();
            });
            incoming.on('end', () => {
                upstream.push({ headers: incoming.headers, body });
                response.writeHead(200, { 'content-type': 'application/json' });
                response.end(JSON.stringify(incoming.url === '/token'
                    ? { access_token: 'server-own-token', token_type: 'Bearer', expires_in: 600 }
                    : { mode: 'VECTOR', models: [], results: [] }));
            });
        });
        await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));

        const base = new URL(`http://127.0.0.1:${(fake.address() as AddressInfo).port}`);
        const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ConfigService.prototype), 'config')!.get!;

        vi.spyOn(ConfigService.prototype, 'config', 'get').mockImplementation(function (this: ConfigService) {
            const value = original.call(this) as ConfigService['config'];
            const api = value.externalApis.KNOWLEDGE_BASE_API;

            if (api.auth?.strategy === 'token-exchange') {
                api.auth.request.url = new URL('/token', base).toString();
            }

            return { ...value, externalApis: { KNOWLEDGE_BASE_API: { ...api, baseURL: base.toString(), resilience: undefined } } };
        });
    });
    afterAll(async () => {
        vi.restoreAllMocks();
        await new Promise((resolve) => fake.close(resolve));
    });

    beforeEach(PlatformTest.bootstrap(Server, {
        mcp: toMcpSettings({ publicURL: TEST_PUBLIC_URL, mcpServers: { DEVELOPMENT_KB: TEST_SERVER } }, { version: '9.9.9' }, ObjectUtils.values(tools))
    }));
    beforeEach(() => {
        request = SuperTest.agent(PlatformTest.callback());
    });
    afterEach(PlatformTest.reset);

    it('publishes its Protected Resource Metadata: the resource, Authentik as the authorization server, the scopes to ask for', async () => {
        expect.assertions(2);

        const response = await request.get(METADATA_PATH);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            resource: 'http://localhost:4004/development',
            authorization_servers: ['https://issuer.test/'],
            // `profile` makes Authentik put the endpoint's application in `aud`.
            scopes_supported: ['openid', 'profile', 'email', 'roles'],
            resource_name: 'Test title'
        });
    });

    it('answers a request without a token with 401 and a challenge pointing at the metadata', async () => {
        expect.assertions(3);

        const response = await post();

        expect(response.status).toBe(401);
        expect(response.headers['www-authenticate']).toContain(`resource_metadata="${TEST_PUBLIC_URL}${METADATA_PATH}"`);
        expect(response.headers['www-authenticate']).toContain('scope="openid profile email roles"');
    });

    it.each([
        ['another issuer', { issuer: 'https://other-issuer.test/' }],
        ['another audience', { audience: 'kb-home-local' }],
        ['an expired token', { expiresIn: '-5m' }]
    ])('answers %s with 401 and the challenge', async (_case, options) => {
        expect.assertions(2);

        const response = await post(await userToken(options));

        expect(response.status).toBe(401);
        expect(response.headers['www-authenticate']).toContain('error="invalid_token"');
    });

    it('answers a good token with neither of the endpoint\'s roles with 403, not 401', async () => {
        expect.assertions(2);

        const response = await post(await userToken({ claims: { roles: ['kb-home.reader'] } }));

        expect(response.status).toBe(403);
        expect(response.headers['www-authenticate']).toContain('error="insufficient_scope"');
    });

    it('serves a reader', async () => {
        expect.assertions(2);

        const response = await post(await userToken());

        expect(response.status).toBe(200);
        expect(response.body.result.serverInfo).toMatchObject({ name: 'test-server' });
    });

    it('never passes the caller\'s token on: knowledge-base-api gets this server\'s own', async () => {
        expect.assertions(3);

        const token = await userToken();
        const response = await request.post('/development').set(MCP_HEADERS).set('Authorization', `Bearer ${token}`)
            .send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search', arguments: { query: 'q' } } });

        expect(response.body.result.isError).toBeUndefined();
        expect(upstream.find((call) => call.headers.authorization === 'Bearer server-own-token')).toBeDefined();
        expect(upstream.some((call) => JSON.stringify(call).includes(token))).toBe(false);
    });
});
