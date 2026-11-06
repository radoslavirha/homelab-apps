import { describe, expect, it } from 'vitest';
import { TEST_OPEN_SERVER, TEST_SERVER } from '../../test/fixtures.js';
import { McpAuthType } from './McpAuthType.enum.js';
import { DEFAULT_UNAUTHENTICATED_ROLES, McpServerAuthConfigSchema } from './McpServerAuthConfig.js';

/** `value` without `key`, as a config that never set it. */
const without = <T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> =>
    Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as Omit<T, K>;

const UNTYPED_OAUTH = without(TEST_SERVER.auth, 'type');
const OPEN = without(TEST_OPEN_SERVER.auth, 'subjectKind');

describe('McpServerAuthConfigSchema', () => {
    it('accepts an `oauth` entry', () => {
        expect(McpServerAuthConfigSchema.safeParse(TEST_SERVER.auth).data).toEqual(TEST_SERVER.auth);
    });

    it('reads an entry without `type` as `oauth`: a config from before the choice still parses', () => {
        expect(McpServerAuthConfigSchema.safeParse(UNTYPED_OAUTH).data).toEqual({ ...UNTYPED_OAUTH, type: McpAuthType.OAuth });
    });

    it('accepts an `unauthenticated` entry, its subject kind `human` by default', () => {
        expect(McpServerAuthConfigSchema.safeParse(OPEN).data).toEqual({ ...OPEN, subjectKind: 'human' });
    });

    it('grants every level under placeholder roles when an `unauthenticated` entry names no roles', () => {
        const result = McpServerAuthConfigSchema.safeParse(without(OPEN, 'roles'));

        expect(result.data?.roles).toEqual(DEFAULT_UNAUTHENTICATED_ROLES);
        expect(Object.keys(result.data?.roles ?? {}).sort()).toEqual(['EDITOR', 'READER']);
    });

    it('keeps explicit roles over the placeholders', () => {
        expect(McpServerAuthConfigSchema.safeParse(OPEN).data?.roles).toEqual(TEST_OPEN_SERVER.auth.roles);
    });

    it('accepts an `unauthenticated` entry granting one level only, without a subject header', () => {
        expect(McpServerAuthConfigSchema.safeParse({ ...without(OPEN, 'subjectHeader'), roles: { READER: 'kb.reader' } }).data?.roles).toEqual({ READER: 'kb.reader' });
    });

    it.each(['a developer', 'dev\nInjected: trailer', '', 'x'.repeat(151)])('refuses the default subject %j, which On-Behalf-Of would refuse', (defaultSubject) => {
        const result = McpServerAuthConfigSchema.safeParse({ ...OPEN, defaultSubject });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['defaultSubject']);
    });

    it('refuses an `unauthenticated` entry granting no level: every tool would refuse', () => {
        const result = McpServerAuthConfigSchema.safeParse({ ...OPEN, roles: {} });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['roles']);
    });

    it('never reads an entry without `type` as `unauthenticated`: it is `oauth` and lacks the issuer', () => {
        expect(McpServerAuthConfigSchema.safeParse(without(OPEN, 'type')).success).toBe(false);
    });

    it('refuses a type it does not know', () => {
        const result = McpServerAuthConfigSchema.safeParse({ ...OPEN, type: 'none' });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['type']);
    });
});
