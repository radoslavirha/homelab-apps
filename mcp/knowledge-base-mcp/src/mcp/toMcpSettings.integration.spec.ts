import { Serializer } from '@radoslavirha/tsed-common';
import { ObjectUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { SearchResponseDTO } from '../endpoints/knowledge-base-api/dto/SearchResponseDTO.js';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import type { McpServerConfig } from '../models/config/McpServerConfig.js';
import { Server } from '../Server.js';
import { ConfigService } from '../services/ConfigService.js';
import { TEST_PUBLIC_URL, TEST_SERVER, userToken } from '../test/fixtures.js';
import * as tools from '../tools/index.js';
import { toMcpSettings } from './toMcpSettings.js';

const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
const API = { description: 'Test description', version: '9.9.9' };
const SEARCH = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search', arguments: { query: 'q' } } };

/** A second endpoint: its own path, knowledge base, audience and roles. */
const OTHER_ROLES = { READER: 'knowledge-base-mcp-other.reader', EDITOR: 'knowledge-base-mcp-other.editor' };
const OTHER_SERVER: McpServerConfig = {
    ...TEST_SERVER,
    path: '/other',
    kb: 'other',
    name: 'other-server',
    title: 'Other title',
    auth: { ...TEST_SERVER.auth, audience: 'other-audience', roles: OTHER_ROLES }
};

/**
 * Two endpoints in one app, which production has never run: `McpServer` has one value, so
 * `toMcpSettings` is called once per endpoint here, as it maps each value when there are two.
 */
const MCP = [
    ...toMcpSettings({ publicURL: TEST_PUBLIC_URL, mcpServers: { DEVELOPMENT_KB: TEST_SERVER } }, API, ObjectUtils.values(tools)),
    ...toMcpSettings({ publicURL: TEST_PUBLIC_URL, mcpServers: { DEVELOPMENT_KB: OTHER_SERVER } }, API, ObjectUtils.values(tools))
];

describe('two MCP endpoints in one app (integration)', () => {
    let request: SuperTest.Agent;
    let search: MockInstance<KnowledgeBaseApiEndpoint['search']>;

    const otherToken = (): Promise<string> => userToken({ audience: 'other-audience', claims: { roles: [OTHER_ROLES.READER] } });

    const post = (path: string, token: string, body: object = SEARCH): SuperTest.Test =>
        request.post(path).set(MCP_HEADERS).set('Authorization', `Bearer ${token}`).send(body);

    beforeAll(() => {
        const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ConfigService.prototype), 'config')!.get!;

        vi.spyOn(ConfigService.prototype, 'config', 'get').mockImplementation(function (this: ConfigService) {
            const value = original.call(this) as ConfigService['config'];

            return { ...value, mcpServers: { ...value.mcpServers, OTHER: OTHER_SERVER } };
        });
    });
    afterAll(() => vi.restoreAllMocks());

    beforeEach(PlatformTest.bootstrap(Server, { mcp: MCP }));
    beforeEach(() => {
        request = SuperTest.agent(PlatformTest.callback());
        search = vi.spyOn(PlatformTest.get<KnowledgeBaseApiEndpoint>(KnowledgeBaseApiEndpoint), 'search')
            .mockResolvedValue(Serializer.deserialize({ mode: 'VECTOR', models: [], results: [] }, SearchResponseDTO));
    });
    afterEach(PlatformTest.reset);

    it.each([
        ['/development', 'development', () => userToken()],
        ['/other', 'other', otherToken]
    ])('%s searches only its own knowledge base', async (path, kb, token) => {
        expect.assertions(2);

        const response = await post(path, await token());

        expect(response.body.result.isError).toBeUndefined();
        expect(search).toHaveBeenCalledWith(expect.objectContaining({ kb }));
    });

    it('offers the same tools on both', async () => {
        expect.assertions(1);

        const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
        const names = async (path: string, token: string): Promise<string[]> =>
            ((await post(path, token, list)).body.result.tools as { name: string }[]).map(({ name }) => name).sort();

        expect(await names('/other', await otherToken())).toEqual(await names('/development', await userToken()));
    });

    it('refuses a token issued for the other endpoint', async () => {
        expect.assertions(3);

        expect((await post('/other', await userToken())).status).toBe(401);
        expect((await post('/development', await otherToken())).status).toBe(401);
        expect(search).not.toHaveBeenCalled();
    });

    it('refuses the other endpoint\'s role with the right audience', async () => {
        expect.assertions(1);

        const response = await post('/other', await userToken({ audience: 'other-audience' }));

        expect(response.status).toBe(403);
    });

    it('checks a tool\'s level against the roles of the endpoint it was called on', async () => {
        expect.assertions(2);

        const note = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_note', arguments: { title: 'A gotcha', type: 'GOTCHA', context: 'c', decisionOrFact: 'd' } } };
        const response = await post('/other', await otherToken(), note);

        expect(response.body.result.isError).toBe(true);
        expect(response.body.result.content[0].text).toContain('Insufficient permissions.');
    });

    it('publishes each endpoint\'s own Protected Resource Metadata', async () => {
        expect.assertions(2);

        const metadata = async (path: string): Promise<unknown> => (await request.get(`/.well-known/oauth-protected-resource${path}`)).body;

        expect(await metadata('/development')).toMatchObject({ resource: `${TEST_PUBLIC_URL}/development`, resource_name: 'Test title' });
        expect(await metadata('/other')).toMatchObject({ resource: `${TEST_PUBLIC_URL}/other`, resource_name: 'Other title' });
    });
});
