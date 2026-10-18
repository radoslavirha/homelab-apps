import { describe, expect, it } from 'vitest';
import { createMcpServersSchema } from './McpServerConfig.js';

const server = (path: string) => ({ path, name: 'n', title: 't' });

describe('createMcpServersSchema', () => {
    const schema = createMcpServersSchema(['DEVELOPMENT_KB', 'HOME_KB']);

    it('accepts one entry per key, each on its own path', () => {
        expect(schema.safeParse({ DEVELOPMENT_KB: server('/kb/development'), HOME_KB: server('/kb/home') }).success).toBe(true);
    });

    it('requires every key the code mounts, naming the missing one', () => {
        const result = schema.safeParse({ DEVELOPMENT_KB: server('/kb/development') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['HOME_KB']);
    });

    it('refuses two servers on one path, since one would shadow the other', () => {
        const result = schema.safeParse({ DEVELOPMENT_KB: server('/kb'), HOME_KB: server('/kb') });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({ path: ['HOME_KB', 'path'], message: 'Path /kb is already used by DEVELOPMENT_KB.' });
    });

    it('refuses a path that does not start with a slash', () => {
        expect(schema.safeParse({ DEVELOPMENT_KB: server('kb/development'), HOME_KB: server('/kb/home') }).success).toBe(false);
    });
});
