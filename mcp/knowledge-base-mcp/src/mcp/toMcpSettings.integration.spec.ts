import { Serializer } from '@radoslavirha/tsed-common';
import { ObjectUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { SearchResponseDTO } from '../endpoints/knowledge-base-api/dto/SearchResponseDTO.js';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { Server } from '../Server.js';
import { TEST_LOXONE_ROLES, TEST_LOXONE_SERVER, TEST_PUBLIC_URL, TEST_SERVERS, userToken } from '../test/fixtures.js';
import * as tools from '../tools/index.js';
import { DEFAULT_INSTRUCTIONS, toMcpSettings } from './toMcpSettings.js';

const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
const API = { description: 'Test description', version: '9.9.9' };
const SEARCH = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search', arguments: { query: 'q' } } };

/** The two endpoints as index.ts builds them, from config/test.json's values. */
const MCP = toMcpSettings({ publicURL: TEST_PUBLIC_URL, mcpServers: TEST_SERVERS }, API, ObjectUtils.values(tools));

describe('two MCP endpoints in one app (integration)', () => {
    let request: SuperTest.Agent;
    let search: MockInstance<KnowledgeBaseApiEndpoint['search']>;

    const loxoneToken = (): Promise<string> => userToken({ audience: TEST_LOXONE_SERVER.auth.audience, claims: { roles: [TEST_LOXONE_ROLES.READER] } });

    const post = (path: string, token: string, body: object = SEARCH): SuperTest.Test =>
        request.post(path).set(MCP_HEADERS).set('Authorization', `Bearer ${token}`).send(body);

    beforeEach(PlatformTest.bootstrap(Server, { mcp: MCP }));
    beforeEach(() => {
        request = SuperTest.agent(PlatformTest.callback());
        search = vi.spyOn(PlatformTest.get<KnowledgeBaseApiEndpoint>(KnowledgeBaseApiEndpoint), 'search')
            .mockResolvedValue(Serializer.deserialize({ mode: 'VECTOR', models: [], results: [] }, SearchResponseDTO));
    });
    afterEach(PlatformTest.reset);

    it.each([
        ['/development', 'development', () => userToken()],
        ['/loxone', 'loxone', loxoneToken]
    ])('%s searches only its own knowledge base', async (path, kb, token) => {
        expect.assertions(2);

        const response = await post(path, await token());

        expect(response.body.result.isError).toBeUndefined();
        expect(search).toHaveBeenCalledWith(expect.objectContaining({ kb }));
    });

    it('hands every endpoint\'s instructions to the client when it initializes', async () => {
        expect.assertions(1);

        const initialize = {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-client', version: '1.0.0' } }
        };

        expect((await post('/development', await userToken(), initialize)).body.result.instructions).toBe(DEFAULT_INSTRUCTIONS);
    });

    it('offers the same tools on both', async () => {
        expect.assertions(1);

        const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
        const names = async (path: string, token: string): Promise<string[]> =>
            ((await post(path, token, list)).body.result.tools as { name: string }[]).map(({ name }) => name).sort();

        expect(await names('/loxone', await loxoneToken())).toEqual(await names('/development', await userToken()));
    });

    it('refuses a token issued for the other endpoint', async () => {
        expect.assertions(3);

        expect((await post('/loxone', await userToken())).status).toBe(401);
        expect((await post('/development', await loxoneToken())).status).toBe(401);
        expect(search).not.toHaveBeenCalled();
    });

    it('refuses the other endpoint\'s role with the right audience', async () => {
        expect.assertions(1);

        const response = await post('/loxone', await userToken({ audience: TEST_LOXONE_SERVER.auth.audience }));

        expect(response.status).toBe(403);
    });

    it('checks a tool\'s level against the roles of the endpoint it was called on', async () => {
        expect.assertions(2);

        const note = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_note', arguments: { title: 'A gotcha', type: 'GOTCHA', context: 'c', decisionOrFact: 'd' } } };
        const response = await post('/loxone', await loxoneToken(), note);

        expect(response.body.result.isError).toBe(true);
        expect(response.body.result.content[0].text).toContain('Insufficient permissions.');
    });

    it.each(Object.entries(TEST_SERVERS))('mounts %s from config, with its own Protected Resource Metadata', async (_key, server) => {
        expect.assertions(1);

        const response = await request.get(`/.well-known/oauth-protected-resource${server.path}`);

        expect(response.body).toMatchObject({ resource: `${TEST_PUBLIC_URL}${server.path}`, resource_name: server.title });
    });
});
