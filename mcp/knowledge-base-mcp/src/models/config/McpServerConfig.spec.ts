import { describe, expect, it } from 'vitest';
import { TEST_LOXONE_SERVER, TEST_SERVER } from '../../test/fixtures.js';
import { McpServersSchema } from './McpServerConfig.js';

const server = (path: string) => ({ ...TEST_SERVER, path });

describe('McpServersSchema', () => {
    it('accepts a single endpoint', () => {
        expect(McpServersSchema.safeParse({ WORK_KB: server('/work') }).success).toBe(true);
    });

    it('accepts any number of endpoints, under any UPPER_SNAKE_CASE keys, each on its own path', () => {
        const result = McpServersSchema.safeParse({ DEVELOPMENT_KB: server('/development'), HOME_KB: server('/home'), TEAM2_KB: server('/team') });

        expect(result.success).toBe(true);
        expect(Object.keys(result.data ?? {})).toEqual(['DEVELOPMENT_KB', 'HOME_KB', 'TEAM2_KB']);
    });

    it('accepts the homelab production config unchanged, its `auth` without a `type` read as `oauth`', () => {
        const untyped = <T extends { auth: object }>(server: T): T => ({ ...server, auth: Object.fromEntries(Object.entries(server.auth).filter(([key]) => key !== 'type')) });
        const production = { DEVELOPMENT_KB: untyped(TEST_SERVER), LOXONE_KB: untyped(TEST_LOXONE_SERVER) };

        expect(McpServersSchema.safeParse(production).data).toEqual({ DEVELOPMENT_KB: TEST_SERVER, LOXONE_KB: TEST_LOXONE_SERVER });
    });

    it('refuses an empty map: an app without an endpoint serves nothing', () => {
        const result = McpServersSchema.safeParse({});

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe('At least one MCP server is required.');
    });

    it.each(['development', 'Development_Kb', 'DEV-KB', '_DEV', 'DEV__KB', '1KB', ''])('refuses the key %j, naming it', (key) => {
        const result = McpServersSchema.safeParse({ [key]: server('/development') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual([key]);
    });

    it('refuses two servers on one path, since one would shadow the other', () => {
        const result = McpServersSchema.safeParse({ DEVELOPMENT_KB: server('/shared'), HOME_KB: server('/shared') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: ['HOME_KB', 'path'], message: 'Path /shared is already used by DEVELOPMENT_KB.' });
    });

    it('refuses paths differing only in case, since Express routes both to the first', () => {
        const result = McpServersSchema.safeParse({ DEVELOPMENT_KB: server('/shared'), HOME_KB: server('/Shared') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: ['HOME_KB', 'path'], message: 'Path /Shared is already used by DEVELOPMENT_KB.' });
    });

    it('refuses a path that does not start with a slash', () => {
        expect(McpServersSchema.safeParse({ DEVELOPMENT_KB: server('development') }).success).toBe(false);
    });

    it('requires the knowledge base an endpoint serves, naming the endpoint', () => {
        // The endpoint is its knowledge base; without one, a call would fall back to every KB the client may read.
        const result = McpServersSchema.safeParse({ DEVELOPMENT_KB: { path: '/development', name: 'n', title: 't', auth: TEST_SERVER.auth }, HOME_KB: server('/home') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['DEVELOPMENT_KB', 'kb']);
    });
});
