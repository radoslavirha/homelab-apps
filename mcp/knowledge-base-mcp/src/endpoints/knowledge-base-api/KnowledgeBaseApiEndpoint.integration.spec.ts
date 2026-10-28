import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// registers the HttpProviderService override bound to this server's config
import '../../providers/HttpProviderProvider.js';
import { ConfigService } from '../../services/ConfigService.js';
import { DocumentDeleteRequestDTO } from './dto/DocumentDeleteRequestDTO.js';
import { DocumentWriteRequestDTO } from './dto/DocumentWriteRequestDTO.js';
import { NoteCreateRequestDTO } from './dto/NoteCreateRequestDTO.js';
import { NoteTypeDTO } from './dto/NoteTypeDTO.enum.js';
import { SearchQueryDTO } from './dto/SearchQueryDTO.js';
import { KnowledgeBaseApiEndpoint } from './KnowledgeBaseApiEndpoint.js';

/**
 * Plays both sides the endpoint talks to: Authentik's token endpoint (`POST /token`) and
 * knowledge-base-api (`GET /search`), which accepts only the tokens it has not revoked.
 */
interface Upstream {
    readonly tokenRequests: { contentType: string | undefined; form: Record<string, string> }[];
    readonly apiCalls: (string | undefined)[];
    valid: Set<string>;
    refuseAll: boolean;
}

const readBody = (request: IncomingMessage): Promise<string> => new Promise((resolve) => {
    let body = '';

    request.on('data', (part: Buffer) => {
        body += part.toString();
    });
    request.on('end', () => resolve(body));
});

describe('KnowledgeBaseApiEndpoint (integration): the token flow', () => {
    const upstream: Upstream = { tokenRequests: [], apiCalls: [], valid: new Set(), refuseAll: false };
    let server: Server;
    let endpoint: KnowledgeBaseApiEndpoint;

    const search = (): Promise<unknown> => endpoint.search(CommonUtils.buildModelStrict(SearchQueryDTO, { q: 'pods' }));

    beforeAll(async () => {
        server = createServer(async (request, response) => {
            if (request.method === 'POST' && request.url === '/token') {
                const token = `token-${upstream.tokenRequests.length + 1}`;

                upstream.tokenRequests.push({
                    contentType: request.headers['content-type'],
                    form: Object.fromEntries(new URLSearchParams(await readBody(request)))
                });
                upstream.valid.add(token);
                response.writeHead(200, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: 600 }));

                return;
            }

            const authorization = request.headers.authorization;

            upstream.apiCalls.push(authorization);

            if (upstream.refuseAll || !upstream.valid.has(String(authorization).replace('Bearer ', ''))) {
                response.writeHead(401, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ name: 'UNAUTHORIZED', message: 'Authentication required.', status: 401 }));

                return;
            }

            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ mode: 'VECTOR', models: [], results: [] }));
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

        // Point the configured upstream (config/test.json) at this server, before the client is built.
        const { port } = server.address() as AddressInfo;
        const base = new URL(`http://127.0.0.1:${port}`);
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
        await new Promise((resolve) => server.close(resolve));
    });

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        endpoint = PlatformTest.get<KnowledgeBaseApiEndpoint>(KnowledgeBaseApiEndpoint);
        upstream.refuseAll = false;
    });
    afterEach(PlatformTest.reset);

    it('fetches a client_credentials token itself, form-encoded, and calls the API with it', async () => {
        expect.assertions(3);

        // Whatever an earlier test left cached is no longer accepted.
        upstream.valid = new Set();
        await search();

        const request = upstream.tokenRequests.at(-1);

        expect(request?.contentType).toBe('application/x-www-form-urlencoded');
        expect(request?.form).toEqual({
            grant_type: 'client_credentials',
            client_id: 'knowledge-base-mcp',
            client_secret: 'test-secret-not-a-real-one',
            scope: 'openid profile email roles'
        });
        expect(upstream.apiCalls.at(-1)).toBe(`Bearer token-${upstream.tokenRequests.length}`);
    });

    it('reuses its token across calls', async () => {
        expect.assertions(2);

        await search();

        const tokens = upstream.tokenRequests.length;
        const calls = upstream.apiCalls.length;

        await search();
        await search();

        expect(upstream.tokenRequests.length).toBe(tokens);
        expect(upstream.apiCalls.length).toBe(calls + 2);
    });

    it('fetches a new token when the API refuses the cached one (it expired), and retries the call once', async () => {
        expect.assertions(3);

        await search();
        upstream.valid = new Set();

        const tokens = upstream.tokenRequests.length;
        const calls = upstream.apiCalls.length;

        await expect(search()).resolves.toBeDefined();
        expect(upstream.tokenRequests.length).toBe(tokens + 1);
        // The refused call and its retry.
        expect(upstream.apiCalls.length).toBe(calls + 2);
    });

    it('gives up after that one retry when the new token is refused too', async () => {
        expect.assertions(2);

        await search();
        upstream.refuseAll = true;

        const calls = upstream.apiCalls.length;

        await expect(search()).rejects.toThrow();
        expect(upstream.apiCalls.length).toBe(calls + 2);
    });
});

describe('KnowledgeBaseApiEndpoint (integration): writes', () => {
    const writes: string[] = [];
    let server: Server;
    let endpoint: KnowledgeBaseApiEndpoint;

    beforeAll(async () => {
        server = createServer(async (request, response) => {
            if (request.url === '/token') {
                response.writeHead(200, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ access_token: 't', token_type: 'Bearer', expires_in: 600 }));

                return;
            }
            await readBody(request);
            writes.push(`${request.method} ${request.url}`);
            // The first attempt commits, then the API's answer is lost to a 502; a replay finds its own write.
            if (writes.length === 1) {
                response.writeHead(502, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ name: 'BAD_GATEWAY', message: 'GitHub responded with 502', status: 502 }));

                return;
            }
            if (request.method === 'DELETE') {
                response.writeHead(404, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ name: 'NOT_FOUND', message: 'raw/a.md no longer exists.', status: 404 }));

                return;
            }
            response.writeHead(409, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ name: 'CONFLICT', message: 'raw/a.md already exists.', status: 409, errors: [{ name: 'CURRENT', content: '# A note', version: 'c1' }] }));
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

        const { port } = server.address() as AddressInfo;
        const base = new URL(`http://127.0.0.1:${port}`);
        const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ConfigService.prototype), 'config')!.get!;

        // Keeps config/test.json's resilience (the production one): timeout, one retry on 5xx.
        vi.spyOn(ConfigService.prototype, 'config', 'get').mockImplementation(function (this: ConfigService) {
            const value = original.call(this) as ConfigService['config'];
            const api = value.externalApis.KNOWLEDGE_BASE_API;

            if (api.auth?.strategy === 'token-exchange') {
                api.auth.request.url = new URL('/token', base).toString();
            }

            return { ...value, externalApis: { KNOWLEDGE_BASE_API: { ...api, baseURL: base.toString() } } };
        });
    });
    afterAll(async () => {
        vi.restoreAllMocks();
        await new Promise((resolve) => server.close(resolve));
    });

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        endpoint = PlatformTest.get<KnowledgeBaseApiEndpoint>(KnowledgeBaseApiEndpoint);
        writes.length = 0;
    });
    afterEach(PlatformTest.reset);

    it.each([
        ['create_note', 'POST /notes', (): Promise<unknown> => endpoint.createNote(
            CommonUtils.buildModelStrict(NoteCreateRequestDTO, { kb: 'development', title: 'A note', type: NoteTypeDTO.Gotcha, context: 'c', decisionOrFact: 'f' }),
            'radoslav'
        )],
        ['write_document', 'PUT /documents', (): Promise<unknown> => endpoint.writeDocument(
            CommonUtils.buildModelStrict(DocumentWriteRequestDTO, { kb: 'development', id: 'raw/a.md', content: '# A', version: 'c0' }),
            'radoslav'
        )],
        ['delete_document', 'DELETE /documents', (): Promise<unknown> => endpoint.deleteDocument(
            CommonUtils.buildModelStrict(DocumentDeleteRequestDTO, { kb: 'development', id: 'raw/a.md', version: 'c0', reason: 'r' }),
            'radoslav'
        )]
    ])('sends %s once: a write that failed with a 5xx may have committed, and a replay is a second write', async (_tool, call, write) => {
        expect.assertions(2);

        await expect(write()).rejects.toThrow();
        expect(writes).toEqual([call]);
    });
});
