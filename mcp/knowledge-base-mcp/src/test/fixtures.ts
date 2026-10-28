import { mintTestToken, TEST_SECRET, type MintTestTokenOptions } from '@radoslavirha/auth';
import { DEFAULT_SCOPES } from '../models/config/McpServerAuthConfig.js';
import type { McpServerConfig } from '../models/config/McpServerConfig.js';

/** config/test.json's endpoint roles, by level. */
export const TEST_ROLES = { READER: 'knowledge-base-mcp-development.reader', EDITOR: 'knowledge-base-mcp-development.editor' };

export const TEST_PUBLIC_URL = 'http://localhost:4004';

/**
 * config/test.json's endpoint, inline so a spec shows what it bootstraps. Path, `kb` and `auth`
 * must stay as there: `McpEndpointService` reads the path from the config. The issuer, audience
 * and secret are `mintTestToken`'s defaults.
 */
export const TEST_SERVER: McpServerConfig = {
    path: '/development',
    kb: 'development',
    name: 'test-server',
    title: 'Test title',
    auth: {
        issuer: 'https://issuer.test/',
        audience: 'test-audience',
        key: { source: 'value', algorithm: 'HS256', value: TEST_SECRET },
        roles: TEST_ROLES,
        scopes: DEFAULT_SCOPES
    }
};

/** A token the test endpoint accepts — a reader — unless `options` say otherwise. */
export const userToken = (options: MintTestTokenOptions = {}): Promise<string> =>
    mintTestToken({ ...options, claims: { roles: [TEST_ROLES.READER], ...options.claims } });
