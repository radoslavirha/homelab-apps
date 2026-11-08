import { createServer, type IncomingHttpHeaders, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ObjectUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from '../Server.js';
import { ConfigService } from '../services/ConfigService.js';
import { TEST_OPEN_SERVER, TEST_PUBLIC_URL } from '../test/fixtures.js';
import * as tools from '../tools/index.js';
import { toMcpSettings } from './toMcpSettings.js';

type Api = ConfigService['config']['externalApis']['KNOWLEDGE_BASE_API'];

const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
const NOTE = { title: 'A gotcha', type: 'GOTCHA', context: 'c', decisionOrFact: 'd' };

/** The same endpoint granting `READER` only, at its own path. */
const READ_ONLY_SERVER = { ...TEST_OPEN_SERVER, path: '/open-read', kb: 'open-read', auth: { ...TEST_OPEN_SERVER.auth, roles: { READER: TEST_OPEN_SERVER.auth.roles.READER } } };
const MCP_SERVERS = { OPEN_KB: TEST_OPEN_SERVER, OPEN_READ_KB: READ_ONLY_SERVER };

/**
 * The pairing for a trusted network with no IdP: MCP endpoints of type `unauthenticated`, the
 * upstream called with http-provider's `none` strategy, knowledge-base-api itself `unauthenticated`
 * (played here by a fake that records what it receives).
 */
describe('unauthenticated MCP endpoint (integration)', () => {
    const upstream: { url: string; headers: IncomingHttpHeaders }[] = [];
    let fake: HttpServer;
    let request: SuperTest.Agent;
    let id = 0;

    /** One JSON-RPC call, with no `Authorization` header; resolves to the whole response. */
    const call = (path: string, method: string, params?: object, headers: Record<string, string> = {}): SuperTest.Test =>
        request.post(path).set({ ...MCP_HEADERS, ...headers }).send({ jsonrpc: '2.0', id: ++id, method, params });
    const createNote = (path: string, headers?: Record<string, string>): SuperTest.Test =>
        call(path, 'tools/call', { name: 'create_note', arguments: NOTE }, headers);

    beforeAll(async () => {
        fake = createServer((incoming, response) => {
            incoming.resume();
            incoming.on('end', () => {
                upstream.push({ url: incoming.url ?? '', headers: incoming.headers });
                response.writeHead(incoming.url?.startsWith('/notes') ? 201 : 200, { 'content-type': 'application/json' });
                response.end(JSON.stringify(incoming.url?.startsWith('/notes')
                    ? { id: 'raw/2026-11-06-a-gotcha.md', version: 'b1', commit: 'c1' }
                    : { mode: 'VECTOR', models: [], results: [] }));
            });
        });
        await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));

        const baseURL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
        const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ConfigService.prototype), 'config')!.get!;

        vi.spyOn(ConfigService.prototype, 'config', 'get').mockImplementation(function (this: ConfigService) {
            const value = original.call(this) as ConfigService['config'];
            // http-provider's `none` strategy; its enum is not re-exported by tsed-http-provider.
            const auth = { strategy: 'none' } as Api['auth'];
            const api: Api = { ...value.externalApis.KNOWLEDGE_BASE_API, baseURL, auth, resilience: undefined };

            return { ...value, mcpServers: MCP_SERVERS, externalApis: { KNOWLEDGE_BASE_API: api } };
        });
    });
    afterAll(async () => {
        vi.restoreAllMocks();
        await new Promise((resolve) => fake.close(resolve));
    });

    beforeEach(PlatformTest.bootstrap(Server, {
        mcp: toMcpSettings({ publicURL: TEST_PUBLIC_URL, mcpServers: MCP_SERVERS }, { version: '9.9.9' }, ObjectUtils.values(tools))
    }));
    beforeEach(() => {
        request = SuperTest.agent(PlatformTest.callback());
        upstream.length = 0;
    });
    afterEach(PlatformTest.reset);

    const listedNames = (response: SuperTest.Response): string[] => (response.body.result.tools as { name: string }[]).map(({ name }) => name).sort();

    it('lists all six tools with no Authorization header: the default principal holds every level', async () => {
        expect.assertions(2);

        const response = await call('/open', 'tools/list');

        expect(response.status).toBe(200);
        expect(listedNames(response)).toEqual(['conventions', 'create_note', 'delete_document', 'read', 'search', 'write_document']);
    });

    it('lists only the reading tools when the endpoint grants only READER', async () => {
        expect.assertions(1);

        expect(listedNames(await call('/open-read', 'tools/list'))).toEqual(['conventions', 'read', 'search']);
    });

    it('searches its own knowledge base with no Authorization header, sending none upstream either', async () => {
        expect.assertions(3);

        const response = await call('/open', 'tools/call', { name: 'search', arguments: { query: 'q' } });

        expect(response.body.result.isError).toBeUndefined();
        expect(upstream).toEqual([expect.objectContaining({ url: expect.stringContaining('kb=open') })]);
        expect(upstream[0].headers.authorization).toBeUndefined();
    });

    it('serves no Protected Resource Metadata: there is no authorization server to point at', async () => {
        expect.assertions(1);

        expect((await request.get('/.well-known/oauth-protected-resource/open')).status).toBe(404);
    });

    it('writes on behalf of the X-User the caller names', async () => {
        expect.assertions(2);

        const response = await createNote('/open', { 'X-User': 'alice' });

        expect(response.body.result.isError).toBeUndefined();
        expect(upstream.find(({ url }) => url.startsWith('/notes'))?.headers['on-behalf-of']).toBe('alice');
    });

    it('writes on behalf of the default subject without X-User', async () => {
        expect.assertions(2);

        const response = await createNote('/open');

        expect(response.body.result.isError).toBeUndefined();
        expect(upstream.find(({ url }) => url.startsWith('/notes'))?.headers['on-behalf-of']).toBe('developer');
    });

    it('refuses a tool needing EDITOR when the endpoint grants only READER, before the API is called', async () => {
        expect.assertions(3);

        const response = await createNote('/open-read', { 'X-User': 'alice' });

        expect(response.body.result).toBeUndefined();
        expect(response.body.error).toEqual({ code: -32602, message: 'Tool create_note not found' });
        expect(upstream).toEqual([]);
    });
});
