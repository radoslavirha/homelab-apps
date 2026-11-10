import { describe, expect, it } from 'vitest';
import { TEST_LOXONE_SERVER, TEST_SERVER } from '../../test/fixtures.js';
import { McpServersSchema } from './McpServerConfig.js';

const server = (name: string, path: string) => ({ ...TEST_SERVER, name, path });

describe('McpServersSchema', () => {
    it('accepts a single endpoint', () => {
        expect(McpServersSchema.safeParse([server('work', '/work')]).success).toBe(true);
    });

    it('accepts any number of endpoints, each with its own name and path, in config order', () => {
        const result = McpServersSchema.safeParse([server('development', '/development'), server('home', '/home'), server('team', '/team')]);

        expect(result.success).toBe(true);
        expect(result.data?.map(({ name }) => name)).toEqual(['development', 'home', 'team']);
    });

    it('reads an `auth` without a `type` as `oauth`', () => {
        const untyped = <T extends { auth: object }>(server: T): T => ({ ...server, auth: Object.fromEntries(Object.entries(server.auth).filter(([key]) => key !== 'type')) });

        expect(McpServersSchema.safeParse([untyped(TEST_SERVER), untyped(TEST_LOXONE_SERVER)]).data).toEqual([TEST_SERVER, TEST_LOXONE_SERVER]);
    });

    it('refuses the old map shape: endpoints are a list', () => {
        expect(McpServersSchema.safeParse({ DEVELOPMENT_KB: TEST_SERVER }).success).toBe(false);
    });

    it('refuses an empty list: an app without an endpoint serves nothing', () => {
        const result = McpServersSchema.safeParse([]);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe('At least one MCP server is required.');
    });

    it('refuses two servers with one name, since the name identifies the endpoint in logs and auth', () => {
        const result = McpServersSchema.safeParse([server('shared', '/development'), server('shared', '/home')]);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: [1, 'name'], message: 'Name shared is already used by mcpServers[0].' });
    });

    it('refuses two servers on one path, since one would shadow the other', () => {
        const result = McpServersSchema.safeParse([server('development', '/shared'), server('home', '/shared')]);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: [1, 'path'], message: 'Path /shared is already used by development.' });
    });

    it('refuses paths differing only in case, since Express routes both to the first', () => {
        const result = McpServersSchema.safeParse([server('development', '/shared'), server('home', '/Shared')]);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: [1, 'path'], message: 'Path /Shared is already used by development.' });
    });

    it('refuses a path that does not start with a slash', () => {
        expect(McpServersSchema.safeParse([server('development', 'development')]).success).toBe(false);
    });

    it('requires the knowledge base an endpoint serves, naming the entry', () => {
        // The endpoint is its knowledge base; without one, a call would fall back to every KB the client may read.
        const result = McpServersSchema.safeParse([{ path: '/development', name: 'n', title: 't', auth: TEST_SERVER.auth }, server('home', '/home')]);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual([0, 'kb']);
    });

    it('leaves `search` out when an endpoint has none: the defaults apply at the call', () => {
        expect(McpServersSchema.parse([TEST_SERVER])[0].search).toBeUndefined();
    });

    it('accepts a second endpoint on the same knowledge base with its own search settings', () => {
        const experiment = { ...server('development-qwen', '/development-qwen'), search: { model: 'qwen3-embedding:0.6b', weights: { fullText: 0.3 } } };
        const result = McpServersSchema.safeParse([TEST_SERVER, experiment]);

        expect(result.success).toBe(true);
        expect(result.data?.[1].search).toEqual({ defaultLimit: 8, maxLimit: 50, model: 'qwen3-embedding:0.6b', weights: { vector: 1, fullText: 0.3 } });
    });

    it('refuses a default limit above the max at boot, naming the entry', () => {
        const result = McpServersSchema.safeParse([{ ...TEST_SERVER, search: { defaultLimit: 25, maxLimit: 20 } }]);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual([0, 'search', 'defaultLimit']);
    });
});
