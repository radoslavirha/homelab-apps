import { describe, expect, it } from 'vitest';
import { TEST_SERVER } from '../../test/fixtures.js';
import { ConfigSchema } from './ConfigModel.js';

/** The upstream, as config/localhost.json has it: a client_credentials token from Authentik. */
const UPSTREAM = {
    baseURL: 'https://kb-api.test',
    auth: {
        strategy: 'token-exchange',
        request: {
            method: 'POST',
            url: 'https://auth.test/application/o/token/',
            headers: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }],
            body: { grant_type: 'client_credentials', client_id: 'knowledge-base-mcp', client_secret: 'not-a-real-one', scope: 'openid profile email roles' }
        },
        tokenExtractor: 'access_token',
        transport: { headers: [{ name: 'Authorization', credential: 'value', prefix: 'Bearer ' }] }
    }
};

const MCP_SERVERS = { DEVELOPMENT_KB: TEST_SERVER };

const MINIMAL = { server: { httpPort: 4004 }, publicURL: 'http://localhost:4004', mcpServers: MCP_SERVERS, externalApis: { KNOWLEDGE_BASE_API: UPSTREAM } };

describe('ConfigSchema', () => {
    it('accepts the minimal config: the server, the MCP servers and the upstream, everything else optional', () => {
        expect(ConfigSchema.safeParse(MINIMAL).success).toBe(true);
    });

    it('accepts a full local config', () => {
        const result = ConfigSchema.safeParse({
            ...MINIMAL,
            health: {},
            logger: { level: 'info' },
            otel: { traces: { enabled: false, exporter: { url: 'http://localhost:4318/v1/traces' } } }
        });

        expect(result.success).toBe(true);
    });

    it('keeps a key it does not know yet, so a newer config does not stop an older pod', () => {
        // The repository-wide rule: config changes are additive across a rolling deploy.
        expect(ConfigSchema.safeParse({ ...MINIMAL, upstream: { url: 'https://api.test' } }).success).toBe(true);
    });

    it('requires the MCP servers, naming the missing one', () => {
        const result = ConfigSchema.safeParse({ server: { httpPort: 4004 }, publicURL: 'http://localhost:4004', externalApis: { KNOWLEDGE_BASE_API: UPSTREAM } });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['mcpServers']);
    });

    it('requires the upstream, naming it', () => {
        const result = ConfigSchema.safeParse({ server: { httpPort: 4004 }, publicURL: 'http://localhost:4004', mcpServers: MCP_SERVERS });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['externalApis']);
    });

    it('requires the public URL: each endpoint\'s resource identifier is built from it', () => {
        const result = ConfigSchema.safeParse({ server: MINIMAL.server, mcpServers: MCP_SERVERS, externalApis: MINIMAL.externalApis });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['publicURL']);
    });

    it('refuses an endpoint without auth: there is no anonymous endpoint', () => {
        const { path, kb, name, title } = TEST_SERVER;
        const result = ConfigSchema.safeParse({ ...MINIMAL, mcpServers: { DEVELOPMENT_KB: { path, kb, name, title } } });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['mcpServers', 'DEVELOPMENT_KB', 'auth']);
    });

    it('refuses scopes without profile or roles, which would leave every token refused', () => {
        const result = ConfigSchema.safeParse({ ...MINIMAL, mcpServers: { DEVELOPMENT_KB: { ...TEST_SERVER, auth: { ...TEST_SERVER.auth, scopes: ['openid', 'roles'] } } } });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['mcpServers', 'DEVELOPMENT_KB', 'auth', 'scopes']);
    });

    it('refuses a port that is not a number, naming the field', () => {
        const result = ConfigSchema.safeParse({ ...MINIMAL, server: { httpPort: 'not-a-port' } });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['server', 'httpPort']);
    });

    it('refuses a log level the logger does not have', () => {
        expect(ConfigSchema.safeParse({ ...MINIMAL, logger: { level: 'chatty' } }).success).toBe(false);
    });
});
