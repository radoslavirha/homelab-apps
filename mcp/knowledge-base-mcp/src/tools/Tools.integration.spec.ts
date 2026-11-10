import { createServer, type IncomingHttpHeaders, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Serializer } from '@radoslavirha/tsed-common';
import { Logger } from '@radoslavirha/tsed-logger';
import { ObjectUtils } from '@radoslavirha/utils';
import { getInterceptorOptions } from '@tsed/di';
import { BadGateway, GatewayTimeout } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConventionsResponseDTO } from '../endpoints/knowledge-base-api/dto/ConventionsResponseDTO.js';
import { DocumentDeleteResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentDeleteResponseDTO.js';
import { DocumentResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentResponseDTO.js';
import { DocumentWriteResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentWriteResponseDTO.js';
import { NoteCreateResponseDTO } from '../endpoints/knowledge-base-api/dto/NoteCreateResponseDTO.js';
import { SearchResponseDTO } from '../endpoints/knowledge-base-api/dto/SearchResponseDTO.js';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { toMcpSettings } from '../mcp/toMcpSettings.js';
import { Server } from '../Server.js';
import { ConfigService } from '../services/ConfigService.js';
import { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { McpSearchConfigSchema } from '../models/config/McpSearchConfig.js';
import { TEST_PUBLIC_URL, TEST_ROLES, TEST_SERVERS, userToken } from '../test/fixtures.js';
import * as tools from './index.js';

const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };

/** The arguments each writing tool takes, enough to call it. */
const WRITES: [string, object][] = [
    ['create_note', { title: 'A gotcha', type: 'GOTCHA', context: 'c', decisionOrFact: 'd' }],
    ['write_document', { id: 'work/2026-10-20-x/spec.md', content: '# X', version: 'b1' }],
    ['delete_document', { id: 'raw/2026-01-01-a-note.md', version: 'b1', reason: 'a mistake' }]
];

/** As http-provider reports an upstream answer: a BadGateway whose origin is the Axios error. */
const upstream = (status: number, data: object): BadGateway => new BadGateway(
    `External API KNOWLEDGE_BASE_API responded with ${status}`,
    Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } })
);

const DOCUMENT = { kb: 'development', externalId: 'raw/2026-01-01-a-note.md', title: 'A note', date: '2026-01-01', url: null, version: 'c1', metadata: { area: 'raw' }, content: '# A note\n\nBody.' };

describe('Tools (integration, through MCP)', () => {
    let request: SuperTest.Agent;
    let api: KnowledgeBaseApiEndpoint;
    let id = 0;

    /** One JSON-RPC call to the MCP endpoint; resolves to its `result`. */
    const send = async (method: string, params?: object): Promise<{ result?: Record<string, unknown>; error?: { code: number; message: string } }> =>
        (await request.post('/development').set(MCP_HEADERS).send({ jsonrpc: '2.0', id: ++id, method, params })).body;
    const call = async (method: string, params?: object): Promise<Record<string, unknown>> => (await send(method, params)).result!;
    const callTool = (name: string, args: object = {}): Promise<Record<string, unknown>> => call('tools/call', { name, arguments: args });

    // index.ts builds the endpoints and registers the tools the same way.
    beforeEach(PlatformTest.bootstrap(Server, {
        mcp: toMcpSettings(
            { publicURL: TEST_PUBLIC_URL, mcpServers: TEST_SERVERS },
            { version: '9.9.9' },
            ObjectUtils.values(tools)
        )
    }));
    beforeEach(async () => {
        request = SuperTest.agent(PlatformTest.callback()).set('Authorization', `Bearer ${await userToken()}`);
        api = PlatformTest.get<KnowledgeBaseApiEndpoint>(KnowledgeBaseApiEndpoint);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    /** The caller's token for the rest of the test, holding `roles`. */
    const signInWith = async (roles: string[]): Promise<void> => {
        request = SuperTest.agent(PlatformTest.callback()).set('Authorization', `Bearer ${await userToken({ claims: { roles } })}`);
    };
    const listedNames = async (): Promise<string[]> => ((await call('tools/list')).tools as { name: string }[]).map(({ name }) => name).sort();

    it('shows a reader the three reading tools only', async () => {
        expect.assertions(1);

        await expect(listedNames()).resolves.toEqual(['conventions', 'read', 'search']);
    });

    it('shows an editor, who holds both roles, all six tools', async () => {
        expect.assertions(1);

        await signInWith([TEST_ROLES.READER, TEST_ROLES.EDITOR]);

        await expect(listedNames()).resolves.toEqual(['conventions', 'create_note', 'delete_document', 'read', 'search', 'write_document']);
    });

    it('shows a caller holding only the editor role the writing tools only: exact strings, no hierarchy', async () => {
        expect.assertions(1);

        await signInWith([TEST_ROLES.EDITOR]);

        await expect(listedNames()).resolves.toEqual(['create_note', 'delete_document', 'write_document']);
    });

    it('lists the six tools, each with an input and an output schema, none taking a knowledge base', async () => {
        expect.assertions(3);

        await signInWith([TEST_ROLES.READER, TEST_ROLES.EDITOR]);
        const { tools: listed } = await call('tools/list') as { tools: { name: string; inputSchema: { properties?: object }; outputSchema?: object }[] };

        expect(listed.map((tool) => tool.name).sort()).toEqual(['conventions', 'create_note', 'delete_document', 'read', 'search', 'write_document']);
        expect(listed.every((tool) => !Object.keys(tool.inputSchema.properties ?? {}).includes('kb'))).toBe(true);
        expect(listed.every((tool) => tool.inputSchema && tool.outputSchema)).toBe(true);
    });

    it('marks the reading tools read-only and the writing ones not, only delete as destructive, none open-world', async () => {
        expect.assertions(1);

        await signInWith([TEST_ROLES.READER, TEST_ROLES.EDITOR]);
        const { tools: listed } = await call('tools/list') as { tools: { name: string; annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean } }[] };

        // MCP clients that ask before running a tool which changes something read these.
        expect(Object.fromEntries(listed.map(({ name, annotations }) => [name, [annotations.readOnlyHint, annotations.destructiveHint, annotations.openWorldHint]]))).toEqual({
            conventions: [true, undefined, false],
            read: [true, undefined, false],
            search: [true, undefined, false],
            create_note: [false, false, false],
            write_document: [false, false, false],
            delete_document: [false, true, false]
        });
    });

    it('every tool declares the least role it needs: a tool without @RequireRole would be open to any caller', () => {
        const declared = ObjectUtils.values(tools).flatMap((tool) => Object.getOwnPropertyNames(tool.prototype)
            .filter((name) => name !== 'constructor')
            .map((name) => [`${tool.name}.${name}`, getInterceptorOptions<KnowledgeBaseRole | undefined>(tool, name)]));

        expect(declared.length).toBeGreaterThan(0);
        expect(declared.filter(([, level]) => !Object.values(KnowledgeBaseRole).includes(level as KnowledgeBaseRole))).toEqual([]);
    });

    it('a caller holding another of the endpoint\'s roles, but not the tool\'s, who calls it anyway is refused before the API is called', async () => {
        expect.assertions(2);

        const search = vi.spyOn(api, 'search');

        // Passes the door (it holds an endpoint role) but lacks READER, which `search` declares.
        await signInWith([TEST_ROLES.EDITOR]);

        // Its server has no such tool: the same answer as for a tool that does not exist.
        await expect(send('tools/call', { name: 'search', arguments: { query: 'q' } })).resolves.toEqual(expect.objectContaining({ error: { code: -32602, message: 'Tool search not found' } }));
        expect(search).not.toHaveBeenCalled();
    });

    it.each(WRITES)('%s: a reader who calls it anyway, though not shown it, is refused before the API is called', async (name, args) => {
        expect.assertions(2);

        const calls = [vi.spyOn(api, 'createNote'), vi.spyOn(api, 'writeDocument'), vi.spyOn(api, 'deleteDocument')];

        await expect(send('tools/call', { name, arguments: args })).resolves.toEqual(expect.objectContaining({ error: { code: -32602, message: `Tool ${name} not found` } }));
        expect(calls.filter((spy) => spy.mock.calls.length > 0)).toEqual([]);
    });

    describe('as an editor', () => {
        beforeEach(async () => {
            request = SuperTest.agent(PlatformTest.callback())
                .set('Authorization', `Bearer ${await userToken({ subject: 'radoslav', claims: { roles: [TEST_ROLES.READER, TEST_ROLES.EDITOR] } })}`);
        });

        it('create_note: commits the note in the endpoint\'s knowledge base for the token\'s user, its type as the API spells it', async () => {
            expect.assertions(3);

            const create = vi.spyOn(api, 'createNote').mockResolvedValue(Serializer.deserialize({ id: 'raw/2026-10-27-a-gotcha.md', version: 'b1', commit: 'c1' }, NoteCreateResponseDTO));

            const result = await callTool('create_note', { ...WRITES[0][1], author: 'someone-else' });

            expect(result.isError).toBeUndefined();
            // An `author` argument is no input: the user comes from the verified token only.
            expect(create).toHaveBeenCalledWith(expect.objectContaining({ kb: 'development', title: 'A gotcha', type: 'GOTCHA' }), 'radoslav');
            expect(result.structuredContent).toEqual({ id: 'raw/2026-10-27-a-gotcha.md', version: 'b1', commit: 'c1' });
        });

        it('write_document: commits the whole document at the caller\'s version, and returns the new one', async () => {
            expect.assertions(3);

            const write = vi.spyOn(api, 'writeDocument').mockResolvedValue(Serializer.deserialize({ id: 'work/2026-10-20-x/spec.md', version: 'b2', commit: 'c2' }, DocumentWriteResponseDTO));

            const result = await callTool('write_document', { ...WRITES[1][1], kb: 'home' });

            expect(result.isError).toBeUndefined();
            expect(write).toHaveBeenCalledWith(expect.objectContaining({ kb: 'development', id: 'work/2026-10-20-x/spec.md', content: '# X', version: 'b1' }), 'radoslav');
            expect(result.structuredContent).toEqual({ id: 'work/2026-10-20-x/spec.md', version: 'b2', commit: 'c2' });
        });

        it('delete_document: deletes at the caller\'s version with the reason', async () => {
            expect.assertions(3);

            const remove = vi.spyOn(api, 'deleteDocument').mockResolvedValue(Serializer.deserialize({ id: 'raw/2026-01-01-a-note.md', commit: 'c3' }, DocumentDeleteResponseDTO));

            const result = await callTool('delete_document', WRITES[2][1]);

            expect(result.isError).toBeUndefined();
            expect(remove).toHaveBeenCalledWith(expect.objectContaining({ kb: 'development', id: 'raw/2026-01-01-a-note.md', version: 'b1', reason: 'a mistake' }), 'radoslav');
            expect(result.structuredContent).toEqual({ id: 'raw/2026-01-01-a-note.md', commit: 'c3' });
        });

        it('write_document: the request log carries no tool arguments — a document is knowledge-base content and may hold a secret the API refuses', async () => {
            expect.assertions(2);

            vi.spyOn(api, 'writeDocument').mockResolvedValue(Serializer.deserialize({ id: 'work/2026-10-20-x/spec.md', version: 'b2', commit: 'c2' }, DocumentWriteResponseDTO));
            const httpLog = (PlatformTest.get<Logger>(Logger) as unknown as { httpLog: { info: (...args: unknown[]) => void } }).httpLog;
            const info = vi.spyOn(httpLog, 'info');

            await callTool('write_document', { ...WRITES[1][1], content: '# X\n\ntoken: ghp_SECRETSECRETSECRETSECRETSECRETSECRET' });

            expect(info).toHaveBeenCalledWith('Request completed', expect.objectContaining({ url: '/development' }));
            expect(JSON.stringify(info.mock.calls)).not.toContain('ghp_SECRET');
        });

        it('write_document: a refusal reaches the caller with the document as it is now, to apply the change to and retry with', async () => {
            expect.assertions(2);

            const body = {
                name: 'CONFLICT',
                message: 'work/2026-10-20-x/spec.md has changed since version b1. Apply your change to the current document and write it with its version.',
                status: 409,
                errors: [{ name: 'CURRENT', message: 'The document as the source holds it now.', content: '# X, edited elsewhere', version: 'b7' }]
            };

            vi.spyOn(api, 'writeDocument').mockRejectedValue(upstream(409, body));

            const result = await callTool('write_document', WRITES[1][1]);

            expect(result.isError).toBe(true);
            expect(JSON.parse((result.content as { text: string }[])[0].text)).toEqual({
                status_code: 409, code: 'E_MCP_TOOL_CONFLICT', message: body.message, current: { content: '# X, edited elsewhere', version: 'b7' }
            });
        });

        it('create_note: a note that already exists reaches the caller as a refusal holding it', async () => {
            expect.assertions(2);

            // A retried create whose first try landed: the note as committed.
            const body = {
                name: 'CONFLICT',
                message: 'raw/2026-10-27-a-gotcha.md already exists. Apply your change to the current document and write it with its version.',
                status: 409,
                errors: [{ name: 'CURRENT', message: 'The document as the source holds it now.', content: '---\ntype: gotcha\n---\n# A gotcha', version: 'b1' }]
            };

            vi.spyOn(api, 'createNote').mockRejectedValue(upstream(409, body));

            const result = await callTool('create_note', WRITES[0][1]);

            expect(result.isError).toBe(true);
            expect(JSON.parse((result.content as { text: string }[])[0].text)).toEqual(expect.objectContaining({ current: { content: body.errors[0].content, version: 'b1' } }));
        });

        it('delete_document: a document that is gone says so', async () => {
            expect.assertions(2);

            vi.spyOn(api, 'deleteDocument').mockRejectedValue(upstream(404, { name: 'NOT_FOUND', message: 'raw/2026-01-01-a-note.md no longer exists.', status: 404, errors: [] }));

            const result = await callTool('delete_document', WRITES[2][1]);

            expect(result.isError).toBe(true);
            expect(JSON.stringify(result.content)).toContain('raw/2026-01-01-a-note.md no longer exists.');
        });
    });

    it('search: hits for the query in the endpoint\'s knowledge base, with the default limit when none is given', async () => {
        expect.assertions(3);

        const search = vi.spyOn(api, 'search').mockResolvedValue(Serializer.deserialize({
            mode: 'VECTOR',
            models: [],
            results: [{ kb: 'development', externalId: DOCUMENT.externalId, anchor: `${DOCUMENT.externalId}#body`, title: 'A note', heading: 'Body', snippet: 'Body.', score: 0.5, date: '2026-01-01', url: null, metadata: {} }]
        }, SearchResponseDTO));

        const result = await callTool('search', { query: 'what is the note about?', filter: 'area:raw' });

        expect(result.isError).toBeUndefined();
        // No `search` block in config/test.json: the defaults, the weights sent all the same.
        expect(search).toHaveBeenCalledWith(expect.objectContaining({ q: 'what is the note about?', kb: 'development', filter: 'area:raw', limit: 8, fullTextWeight: 0, vectorWeight: 1 }));
        expect(result.structuredContent).toEqual({
            hits: [{ id: DOCUMENT.externalId, anchor: `${DOCUMENT.externalId}#body`, title: 'A note', heading: 'Body', snippet: 'Body.', date: '2026-01-01' }]
        });
    });

    it('search: a section before the first heading has an empty heading, which the output schema accepts', async () => {
        expect.assertions(2);

        // As the API sends it for a document's opening text.
        vi.spyOn(api, 'search').mockResolvedValue(Serializer.deserialize({
            mode: 'VECTOR',
            models: [],
            results: [{ kb: 'development', externalId: DOCUMENT.externalId, anchor: DOCUMENT.externalId, title: 'A note', heading: '', snippet: 'Intro.', score: 0.5, date: null, url: null, metadata: {} }]
        }, SearchResponseDTO));

        const result = await callTool('search', { query: 'q' });

        expect(result.isError).toBeUndefined();
        expect(result.structuredContent).toEqual({ hits: [expect.objectContaining({ heading: '', date: null })] });
    });

    it('search: a caller cannot reach another knowledge base by naming one', async () => {
        expect.assertions(1);

        const search = vi.spyOn(api, 'search').mockResolvedValue(Serializer.deserialize({ mode: 'VECTOR', models: [], results: [] }, SearchResponseDTO));

        const result = await callTool('search', { query: 'q', kb: 'home' });

        // An argument the tool does not declare is ignored, not refused: the call succeeds, on `development`.
        expect({ isError: result.isError, kbs: search.mock.calls.map(([query]) => query.kb) }).toEqual({ isError: undefined, kbs: ['development'] });
    });

    it('search: refuses a limit above 50, the API\'s cap, before calling the API', async () => {
        expect.assertions(2);

        const search = vi.spyOn(api, 'search');

        const result = await callTool('search', { query: 'q', limit: 51 });

        expect(result.isError).toBe(true);
        expect(search).not.toHaveBeenCalled();
    });

    describe('search settings of the endpoint', () => {
        /** Gives DEVELOPMENT_KB a `search` block for the rest of the test. */
        const configure = (search: object): void => {
            const configService = PlatformTest.get<ConfigService>(ConfigService);
            const servers = configService.config.mcpServers;

            vi.spyOn(configService, 'config', 'get').mockReturnValue({
                ...configService.config,
                mcpServers: { ...servers, DEVELOPMENT_KB: { ...servers.DEVELOPMENT_KB, search: McpSearchConfigSchema.parse(search) } }
            });
        };
        const empty = (): void => {
            vi.spyOn(api, 'search').mockResolvedValue(Serializer.deserialize({ mode: 'VECTOR', models: [], results: [] }, SearchResponseDTO));
        };

        it('passes the largest limit the tool accepts unchanged under the default max of 50', async () => {
            expect.assertions(1);

            empty();
            await callTool('search', { query: 'q', limit: 50 });

            expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
        });

        it('passes a limit within the max unchanged', async () => {
            expect.assertions(1);

            empty();
            await callTool('search', { query: 'q', limit: 3 });

            expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
        });

        it('uses the endpoint\'s default and max limit, model and weights', async () => {
            expect.assertions(2);

            configure({ defaultLimit: 12, maxLimit: 30, model: 'qwen3-embedding:0.6b', weights: { vector: 0.7, fullText: 0.3 } });
            empty();
            await callTool('search', { query: 'q' });
            await callTool('search', { query: 'q', limit: 45 });

            expect(api.search).toHaveBeenNthCalledWith(1, expect.objectContaining({ limit: 12, model: 'qwen3-embedding:0.6b', vectorWeight: 0.7, fullTextWeight: 0.3 }));
            expect(api.search).toHaveBeenNthCalledWith(2, expect.objectContaining({ limit: 30 }));
        });

        it('leaves the model out when the endpoint names none, so the API uses the knowledge base\'s first', async () => {
            expect.assertions(1);

            empty();
            await callTool('search', { query: 'q' });

            expect(vi.mocked(api.search).mock.calls[0][0].model).toBeUndefined();
        });

        it('ignores a model or weights the agent sends: they are config, never tool arguments', async () => {
            expect.assertions(1);

            empty();
            await callTool('search', { query: 'q', model: 'other', vectorWeight: 0, fullTextWeight: 5 });

            expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ model: undefined, vectorWeight: 1, fullTextWeight: 0 }));
        });
    });

    it('conventions: the endpoint\'s knowledge base\'s conventions, with structured content its output schema accepts', async () => {
        expect.assertions(3);

        const conventions = vi.spyOn(api, 'conventions').mockResolvedValue(Serializer.deserialize({
            kb: 'development', path: 'README.md', markdown: '# House rules\n', version: 'b1'
        }, ConventionsResponseDTO));

        const result = await callTool('conventions', { kb: 'home' });

        expect(result.isError).toBeUndefined();
        // A `kb` argument is ignored, as on every tool: the endpoint is its knowledge base.
        expect(conventions).toHaveBeenCalledWith(expect.objectContaining({ kb: 'development' }));
        expect(result.structuredContent).toEqual({ path: 'README.md', markdown: '# House rules\n' });
    });

    it('conventions: a knowledge base that publishes none answers empty markdown, not an error', async () => {
        expect.assertions(2);

        vi.spyOn(api, 'conventions').mockResolvedValue(Serializer.deserialize({ kb: 'development', path: null, markdown: null, version: null }, ConventionsResponseDTO));

        const result = await callTool('conventions');

        expect(result.isError).toBeUndefined();
        expect(result.structuredContent).toEqual({ path: null, markdown: '' });
    });

    it('read: the whole document from the endpoint\'s knowledge base, with structured content its output schema accepts', async () => {
        expect.assertions(3);

        const document = vi.spyOn(api, 'document').mockResolvedValue(Serializer.deserialize(DOCUMENT, DocumentResponseDTO));

        const result = await callTool('read', { id: DOCUMENT.externalId });

        expect(result.isError).toBeUndefined();
        expect(document).toHaveBeenCalledWith(expect.objectContaining({ id: DOCUMENT.externalId, kb: 'development' }));
        expect(result.structuredContent).toEqual({
            id: DOCUMENT.externalId, title: 'A note', date: '2026-01-01', metadata: { area: 'raw' }, version: 'c1', markdown: '# A note\n\nBody.'
        });
    });

    it('read: a caller cannot reach another knowledge base by naming one', async () => {
        expect.assertions(1);

        const document = vi.spyOn(api, 'document').mockResolvedValue(Serializer.deserialize(DOCUMENT, DocumentResponseDTO));

        const result = await callTool('read', { kb: 'home', id: DOCUMENT.externalId });

        // An argument the tool does not declare is ignored, not refused: the call succeeds, on `development`.
        expect({ isError: result.isError, kbs: document.mock.calls.map(([query]) => query.kb) }).toEqual({ isError: undefined, kbs: ['development'] });
    });

    it('read: a document that is only frontmatter has empty markdown, which the output schema accepts', async () => {
        expect.assertions(2);

        vi.spyOn(api, 'document').mockResolvedValue(Serializer.deserialize({ ...DOCUMENT, content: '' }, DocumentResponseDTO));

        const result = await callTool('read', { id: DOCUMENT.externalId });

        expect(result.isError).toBeUndefined();
        expect(result.structuredContent).toEqual(expect.objectContaining({ markdown: '' }));
    });

    it('read: an id nobody holds says to search first', async () => {
        expect.assertions(2);

        // As http-provider reports it: a BadGateway whose origin is the upstream's Axios error.
        const upstream = Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });

        vi.spyOn(api, 'document').mockRejectedValue(new BadGateway('External API KNOWLEDGE_BASE_API responded with 404', upstream));

        const result = await callTool('read', { id: 'raw/missing.md' });

        expect(result.isError).toBe(true);
        expect(JSON.stringify(result.content)).toContain('Take the id from a search hit');
    });

    it('search: a filter that is not key:value is reported as the caller\'s mistake, not as the API failing', async () => {
        expect.assertions(2);

        // As http-provider reports knowledge-base-api's 400 `Invalid filter "area"; expected key:value.`
        const upstream = Object.assign(new Error('Request failed with status code 400'), { response: { status: 400 } });

        vi.spyOn(api, 'search').mockRejectedValue(new BadGateway('External API KNOWLEDGE_BASE_API responded with 400.', upstream));

        const result = await callTool('search', { query: 'q', filter: 'area' });

        expect(result.isError).toBe(true);
        expect(JSON.stringify(result.content)).toContain('filter');
    });

    it('read: an error that is no HTTP exception at all reaches the caller as it is', async () => {
        expect.assertions(2);

        vi.spyOn(api, 'document').mockRejectedValue(new TypeError('Cannot read properties of undefined'));

        const result = await callTool('read', { id: DOCUMENT.externalId });

        expect(result.isError).toBe(true);
        expect(JSON.stringify(result.content)).toContain('Cannot read properties of undefined');
    });

    it('read: any other upstream failure reaches the caller as it is', async () => {
        expect.assertions(2);

        vi.spyOn(api, 'document').mockRejectedValue(new GatewayTimeout('External API KNOWLEDGE_BASE_API did not respond in time.'));

        const result = await callTool('read', { id: DOCUMENT.externalId });

        expect(result.isError).toBe(true);
        expect(JSON.stringify(result.content)).toContain('did not respond in time');
    });
});

describe('Writing tools (integration, through MCP to a fake knowledge-base-api)', () => {
    /** What the fake API received, per call. */
    const received: { method: string | undefined; url: string | undefined; headers: IncomingHttpHeaders }[] = [];
    let upstreamServer: HttpServer;
    let callerToken: string;
    let refuseClient = false;

    // Authentik's token endpoint and knowledge-base-api in one, as KnowledgeBaseApiEndpoint.integration.spec does.
    beforeAll(async () => {
        upstreamServer = createServer((req, res) => {
            res.setHeader('content-type', 'application/json');

            if (req.url === '/token') {
                if (refuseClient) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'invalid_client', error_description: 'Client authentication failed.' }));

                    return;
                }

                res.end(JSON.stringify({ access_token: 'server-own-token', token_type: 'Bearer', expires_in: 600 }));

                return;
            }

            received.push({ method: req.method, url: req.url, headers: req.headers });
            res.statusCode = 201;
            res.end(JSON.stringify({ id: 'raw/2026-10-27-a-gotcha.md', version: 'b1', commit: 'c1' }));
        });
        await new Promise<void>((resolve) => upstreamServer.listen(0, '127.0.0.1', resolve));

        const base = new URL(`http://127.0.0.1:${(upstreamServer.address() as AddressInfo).port}`);
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
        await new Promise((resolve) => upstreamServer.close(resolve));
    });

    beforeEach(PlatformTest.bootstrap(Server, {
        mcp: toMcpSettings({ publicURL: TEST_PUBLIC_URL, mcpServers: TEST_SERVERS }, { version: '9.9.9' }, ObjectUtils.values(tools))
    }));
    beforeEach(async () => {
        callerToken = await userToken({ subject: 'radoslav', claims: { roles: [TEST_ROLES.READER, TEST_ROLES.EDITOR] } });
    });
    afterEach(PlatformTest.reset);

    it('calls the API with the server\'s own token, never the caller\'s, naming the token\'s user in On-Behalf-Of', async () => {
        expect.assertions(5);

        const response = await SuperTest(PlatformTest.callback()).post('/development').set(MCP_HEADERS).set('Authorization', `Bearer ${callerToken}`)
            .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_note', arguments: { title: 'A gotcha', type: 'GOTCHA', context: 'c', decisionOrFact: 'd' } } });

        expect(response.body.result.isError).toBeUndefined();
        expect(received.map(({ method, url }) => `${method} ${url}`)).toEqual(['POST /notes']);
        expect(received[0].headers.authorization).toBe('Bearer server-own-token');
        expect(received[0].headers['on-behalf-of']).toBe('radoslav');
        expect(JSON.stringify(received)).not.toContain(callerToken);
    });

    it('a token endpoint refusing the server\'s own client is not reported as the caller\'s bad input', async () => {
        expect.assertions(3);

        refuseClient = true;

        const send = (name: string, args: object) => SuperTest(PlatformTest.callback()).post('/development').set(MCP_HEADERS).set('Authorization', `Bearer ${callerToken}`)
            .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

        const search = (await send('search', { query: 'pods' })).body.result;
        const note = (await send('create_note', { title: 'A gotcha', type: 'GOTCHA', context: 'c', decisionOrFact: 'd' })).body.result;

        refuseClient = false;

        expect(search.isError).toBe(true);
        expect(JSON.stringify(search.content)).not.toContain('check `filter`');
        expect(note.structuredContent.status_code).not.toBe(400);
    });
});
