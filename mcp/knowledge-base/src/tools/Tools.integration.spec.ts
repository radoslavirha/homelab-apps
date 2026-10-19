import { Serializer } from '@radoslavirha/tsed-common';
import { ObjectUtils } from '@radoslavirha/utils';
import { getInterceptorOptions } from '@tsed/di';
import { BadGateway, GatewayTimeout } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentResponseDTO.js';
import { SearchResponseDTO } from '../endpoints/knowledge-base-api/dto/SearchResponseDTO.js';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { toMcpSettings } from '../mcp/toMcpSettings.js';
import { Server } from '../Server.js';
import { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { TEST_PUBLIC_URL, TEST_ROLES, TEST_SERVER, userToken } from '../test/fixtures.js';
import * as tools from './index.js';

const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };

const DOCUMENT = { kb: 'dev', externalId: 'raw/2026-01-01-a-note.md', title: 'A note', date: '2026-01-01', url: null, version: 'c1', metadata: { area: 'raw' }, content: '# A note\n\nBody.' };

describe('Tools (integration, through MCP)', () => {
    let request: SuperTest.Agent;
    let api: KnowledgeBaseApiEndpoint;
    let id = 0;

    /** One JSON-RPC call to the MCP endpoint; resolves to its `result`. */
    const call = async (method: string, params?: object): Promise<Record<string, unknown>> => {
        const response = await request.post('/development').set(MCP_HEADERS).send({ jsonrpc: '2.0', id: ++id, method, params });

        return response.body.result;
    };
    const callTool = (name: string, args: object = {}): Promise<Record<string, unknown>> => call('tools/call', { name, arguments: args });

    // index.ts builds the endpoints and registers the tools the same way.
    beforeEach(PlatformTest.bootstrap(Server, {
        mcp: toMcpSettings(
            { publicURL: TEST_PUBLIC_URL, mcpServers: { DEVELOPMENT_KB: TEST_SERVER } },
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

    it('lists the two tools, read-only, each with an input and an output schema, neither taking a knowledge base', async () => {
        expect.assertions(4);

        const { tools: listed } = await call('tools/list') as { tools: { name: string; annotations: object; inputSchema: { properties?: object }; outputSchema?: object }[] };

        expect(listed.map((tool) => tool.name).sort()).toEqual(['read', 'search']);
        expect(listed.every((tool) => !Object.keys(tool.inputSchema.properties ?? {}).includes('kb'))).toBe(true);
        expect(listed.every((tool) => (tool.annotations as { readOnlyHint?: boolean }).readOnlyHint === true)).toBe(true);
        expect(listed.every((tool) => tool.inputSchema && tool.outputSchema)).toBe(true);
    });

    it('every tool declares the least role it needs: a tool without @RequireRole would be open to any caller', () => {
        const declared = ObjectUtils.values(tools).flatMap((tool) => Object.getOwnPropertyNames(tool.prototype)
            .filter((name) => name !== 'constructor')
            .map((name) => [`${tool.name}.${name}`, getInterceptorOptions<KnowledgeBaseRole | undefined>(tool, name)]));

        expect(declared.length).toBeGreaterThan(0);
        expect(declared.filter(([, level]) => !Object.values(KnowledgeBaseRole).includes(level as KnowledgeBaseRole))).toEqual([]);
    });

    it('a caller holding another of the endpoint\'s roles, but not the tool\'s, is refused by the tool before the API is called', async () => {
        expect.assertions(3);

        const search = vi.spyOn(api, 'search');

        // Passes the door (it holds an endpoint role) but lacks READER, which `search` declares.
        request = SuperTest.agent(PlatformTest.callback()).set('Authorization', `Bearer ${await userToken({ claims: { roles: [TEST_ROLES.EDITOR] } })}`);
        const result = await callTool('search', { query: 'q' });

        expect(result.isError).toBe(true);
        expect(JSON.stringify(result.content)).toContain('Insufficient permissions.');
        expect(search).not.toHaveBeenCalled();
    });

    it('search: hits for the query in the endpoint\'s knowledge base, with the default limit when none is given', async () => {
        expect.assertions(3);

        const search = vi.spyOn(api, 'search').mockResolvedValue(Serializer.deserialize({
            mode: 'VECTOR',
            models: [],
            results: [{ kb: 'dev', externalId: DOCUMENT.externalId, anchor: `${DOCUMENT.externalId}#body`, title: 'A note', heading: 'Body', snippet: 'Body.', score: 0.5, date: '2026-01-01', url: null, metadata: {} }]
        }, SearchResponseDTO));

        const result = await callTool('search', { query: 'what is the note about?', filter: 'area:raw' });

        expect(result.isError).toBeUndefined();
        expect(search).toHaveBeenCalledWith(expect.objectContaining({ q: 'what is the note about?', kb: 'dev', filter: 'area:raw', limit: 8 }));
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
            results: [{ kb: 'dev', externalId: DOCUMENT.externalId, anchor: DOCUMENT.externalId, title: 'A note', heading: '', snippet: 'Intro.', score: 0.5, date: null, url: null, metadata: {} }]
        }, SearchResponseDTO));

        const result = await callTool('search', { query: 'q' });

        expect(result.isError).toBeUndefined();
        expect(result.structuredContent).toEqual({ hits: [expect.objectContaining({ heading: '', date: null })] });
    });

    it('search: a caller cannot reach another knowledge base by naming one', async () => {
        expect.assertions(1);

        const search = vi.spyOn(api, 'search').mockResolvedValue(Serializer.deserialize({ mode: 'VECTOR', models: [], results: [] }, SearchResponseDTO));

        const result = await callTool('search', { query: 'q', kb: 'home' });

        // An argument the tool does not declare is ignored, not refused: the call succeeds, on `dev`.
        expect({ isError: result.isError, kbs: search.mock.calls.map(([query]) => query.kb) }).toEqual({ isError: undefined, kbs: ['dev'] });
    });

    it('search: refuses a limit above 20 before calling the API', async () => {
        expect.assertions(2);

        const search = vi.spyOn(api, 'search');

        const result = await callTool('search', { query: 'q', limit: 50 });

        expect(result.isError).toBe(true);
        expect(search).not.toHaveBeenCalled();
    });

    it('read: the whole document from the endpoint\'s knowledge base, with structured content its output schema accepts', async () => {
        expect.assertions(3);

        const document = vi.spyOn(api, 'document').mockResolvedValue(Serializer.deserialize(DOCUMENT, DocumentResponseDTO));

        const result = await callTool('read', { id: DOCUMENT.externalId });

        expect(result.isError).toBeUndefined();
        expect(document).toHaveBeenCalledWith(expect.objectContaining({ id: DOCUMENT.externalId, kb: 'dev' }));
        expect(result.structuredContent).toEqual({
            id: DOCUMENT.externalId, title: 'A note', date: '2026-01-01', metadata: { area: 'raw' }, markdown: '# A note\n\nBody.'
        });
    });

    it('read: a caller cannot reach another knowledge base by naming one', async () => {
        expect.assertions(1);

        const document = vi.spyOn(api, 'document').mockResolvedValue(Serializer.deserialize(DOCUMENT, DocumentResponseDTO));

        const result = await callTool('read', { kb: 'home', id: DOCUMENT.externalId });

        // An argument the tool does not declare is ignored, not refused: the call succeeds, on `dev`.
        expect({ isError: result.isError, kbs: document.mock.calls.map(([query]) => query.kb) }).toEqual({ isError: undefined, kbs: ['dev'] });
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
