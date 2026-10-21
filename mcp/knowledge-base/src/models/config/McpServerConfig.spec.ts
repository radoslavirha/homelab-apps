import { describe, expect, it } from 'vitest';
import { TEST_SERVER } from '../../test/fixtures.js';
import { createMcpServersSchema } from './McpServerConfig.js';

const server = (path: string) => ({ ...TEST_SERVER, path });

describe('createMcpServersSchema', () => {
    const schema = createMcpServersSchema(['DEVELOPMENT_KB', 'HOME_KB']);

    it('accepts one entry per key, each on its own path', () => {
        expect(schema.safeParse({ DEVELOPMENT_KB: server('/development'), HOME_KB: server('/home') }).success).toBe(true);
    });

    it('requires every key the code mounts, naming the missing one', () => {
        const result = schema.safeParse({ DEVELOPMENT_KB: server('/development') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['HOME_KB']);
    });

    it('refuses two servers on one path, since one would shadow the other', () => {
        const result = schema.safeParse({ DEVELOPMENT_KB: server('/shared'), HOME_KB: server('/shared') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: ['HOME_KB', 'path'], message: 'Path /shared is already used by DEVELOPMENT_KB.' });
    });

    it('refuses paths differing only in case, since Express routes both to the first', () => {
        const result = schema.safeParse({ DEVELOPMENT_KB: server('/shared'), HOME_KB: server('/Shared') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: ['HOME_KB', 'path'], message: 'Path /Shared is already used by DEVELOPMENT_KB.' });
    });

    it('refuses a path that does not start with a slash', () => {
        expect(schema.safeParse({ DEVELOPMENT_KB: server('development'), HOME_KB: server('/home') }).success).toBe(false);
    });

    it('requires the knowledge base an endpoint serves, naming the endpoint', () => {
        // The endpoint is its knowledge base; without one, a call would fall back to every KB the client may read.
        const result = schema.safeParse({ DEVELOPMENT_KB: { path: '/development', name: 'n', title: 't', auth: TEST_SERVER.auth }, HOME_KB: server('/home') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['DEVELOPMENT_KB', 'kb']);
    });
});
