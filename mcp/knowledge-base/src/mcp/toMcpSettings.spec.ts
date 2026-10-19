import { describe, expect, it } from 'vitest';
import { McpTokenVerifier } from '../auth/McpTokenVerifier.js';
import { TEST_SERVER } from '../test/fixtures.js';
import { resourceOf, toMcpSettings } from './toMcpSettings.js';

class SomeTool {}

const CONFIG = { publicURL: 'https://mcp.test/kb', mcpServers: { DEVELOPMENT_KB: TEST_SERVER } };

describe('toMcpSettings', () => {
    it('mounts one endpoint per MCP server, at its configured path, with the tools and the app version', () => {
        expect(toMcpSettings(CONFIG, { description: 'From package.json', version: '1.2.3' }, [SomeTool])).toEqual([expect.objectContaining({
            path: '/development',
            name: 'test-server',
            title: 'Test title',
            description: 'From package.json',
            version: '1.2.3',
            tools: [SomeTool]
        })]);
    });

    it('prefers the server\'s own description over the package one', () => {
        const [settings] = toMcpSettings(
            { ...CONFIG, mcpServers: { DEVELOPMENT_KB: { ...TEST_SERVER, description: 'Its own' } } },
            { description: 'From package.json', version: '1.2.3' },
            []
        );

        expect(settings.description).toBe('Its own');
    });

    it('protects every endpoint: Authentik as the authorization server, the public URL plus the path as the resource', () => {
        const [settings] = toMcpSettings(CONFIG, { version: '1.2.3' }, []);

        expect(settings.auth).toEqual({
            issuer: 'https://issuer.test/',
            resource: 'https://mcp.test/kb/development',
            scopesSupported: ['openid', 'profile', 'email', 'roles'],
            resourceName: 'Test title',
            verifier: expect.any(McpTokenVerifier)
        });
    });
});

describe('resourceOf', () => {
    it('joins the public URL and the path, whether or not the URL ends in a slash', () => {
        expect(resourceOf('https://mcp.irha.cz/kb', '/development')).toBe('https://mcp.irha.cz/kb/development');
        expect(resourceOf('https://mcp.irha.cz/kb/', '/development')).toBe('https://mcp.irha.cz/kb/development');
        expect(resourceOf('http://localhost:4004', '/development')).toBe('http://localhost:4004/development');
    });
});
