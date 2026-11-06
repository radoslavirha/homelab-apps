import { mintTestToken, TEST_SECRET, type MintTestTokenOptions } from '@radoslavirha/auth';
import { McpAuthType } from '../models/config/McpAuthType.enum.js';
import { DEFAULT_SCOPES, type McpServerOAuthConfig, type McpServerUnauthenticatedConfig } from '../models/config/McpServerAuthConfig.js';
import type { McpServerConfig } from '../models/config/McpServerConfig.js';

/** An endpoint whose `auth` is narrowed to one type, so a spec can read that type's fields. */
type ServerWith<Auth> = Omit<McpServerConfig, 'auth'> & { auth: Auth };

/** config/test.json's endpoint roles, by level. */
export const TEST_ROLES = { READER: 'knowledge-base-mcp-development.reader', EDITOR: 'knowledge-base-mcp-development.editor' };

export const TEST_PUBLIC_URL = 'http://localhost:4004';

/**
 * config/test.json's endpoint, inline so a spec shows what it bootstraps. Path, `kb` and `auth`
 * must stay as there: `McpEndpointService` reads the path from the config. The issuer, audience
 * and secret are `mintTestToken`'s defaults.
 */
export const TEST_SERVER: ServerWith<McpServerOAuthConfig> = {
    path: '/development',
    kb: 'development',
    name: 'test-server',
    title: 'Test title',
    auth: {
        type: McpAuthType.OAuth,
        issuer: 'https://issuer.test/',
        audience: 'test-audience',
        key: { source: 'value', algorithm: 'HS256', value: TEST_SECRET },
        roles: TEST_ROLES,
        scopes: DEFAULT_SCOPES
    }
};

/** config/test.json's second endpoint's roles, by level. */
export const TEST_LOXONE_ROLES = { READER: 'knowledge-base-mcp-loxone.reader', EDITOR: 'knowledge-base-mcp-loxone.editor' };

/** config/test.json's second endpoint: its own path, knowledge base, audience and roles. */
export const TEST_LOXONE_SERVER: ServerWith<McpServerOAuthConfig> = {
    ...TEST_SERVER,
    path: '/loxone',
    kb: 'loxone',
    name: 'loxone-server',
    title: 'Loxone title',
    auth: { ...TEST_SERVER.auth, audience: 'test-loxone-audience', roles: TEST_LOXONE_ROLES }
};

/**
 * An `unauthenticated` endpoint: no sign-in, every caller a reader and an editor, named by
 * `X-User` when it sends one. Not in config/test.json; a spec adds it.
 */
export const TEST_OPEN_SERVER: ServerWith<McpServerUnauthenticatedConfig> = {
    path: '/open',
    kb: 'open',
    name: 'open-server',
    title: 'Open title',
    auth: {
        type: McpAuthType.Unauthenticated,
        roles: { READER: 'knowledge-base-mcp-open.reader', EDITOR: 'knowledge-base-mcp-open.editor' },
        defaultSubject: 'developer',
        subjectHeader: 'X-User',
        subjectKind: 'human'
    }
};

/** config/test.json's `mcpServers`: the two endpoints, under the keys production uses. */
export const TEST_SERVERS = { DEVELOPMENT_KB: TEST_SERVER, LOXONE_KB: TEST_LOXONE_SERVER };

/** A token the test endpoint accepts — a reader — unless `options` say otherwise. */
export const userToken = (options: MintTestTokenOptions = {}): Promise<string> =>
    mintTestToken({ ...options, claims: { roles: [TEST_ROLES.READER], ...options.claims } });
