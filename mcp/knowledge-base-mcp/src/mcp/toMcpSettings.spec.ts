import { describe, expect, it } from 'vitest';
import { McpTokenVerifier } from '../auth/McpTokenVerifier.js';
import { TEST_LOXONE_SERVER, TEST_OPEN_SERVER, TEST_SERVER, TEST_SERVERS } from '../test/fixtures.js';
import { DEFAULT_INSTRUCTIONS, resourceOf, toMcpSettings } from './toMcpSettings.js';

class SomeTool {}

const CONFIG = { publicURL: 'https://mcp.test/kb', mcpServers: TEST_SERVERS };

describe('toMcpSettings', () => {
    it('mounts one endpoint per MCP server, at its configured path, with the tools and the app version', () => {
        expect(toMcpSettings(CONFIG, { description: 'From package.json', version: '1.2.3' }, [SomeTool])).toEqual([expect.objectContaining({
            path: '/development',
            name: 'test-server',
            title: 'Test title',
            description: 'From package.json',
            version: '1.2.3',
            tools: [SomeTool]
        }), expect.objectContaining({
            path: '/loxone',
            name: 'loxone-server',
            title: 'Loxone title',
            description: 'From package.json',
            version: '1.2.3',
            tools: [SomeTool]
        })]);
    });

    it('mounts every configured entry, in config order', () => {
        const mcpServers = [{ ...TEST_SERVER, name: 'a', path: '/a' }, { ...TEST_SERVER, name: 'b', path: '/b' }, { ...TEST_SERVER, name: 'c', path: '/c' }];

        expect(toMcpSettings({ ...CONFIG, mcpServers }, { version: '1.2.3' }, []).map(({ path }) => path)).toEqual(['/a', '/b', '/c']);
    });

    it('prefers the server\'s own description over the package one', () => {
        const [settings] = toMcpSettings(
            { ...CONFIG, mcpServers: [{ ...TEST_SERVER, description: 'Its own' }, TEST_LOXONE_SERVER] },
            { description: 'From package.json', version: '1.2.3' },
            []
        );

        expect(settings.description).toBe('Its own');
    });

    it('gives every endpoint the default instructions, unless it sets its own', () => {
        const [own, fallback] = toMcpSettings(
            { ...CONFIG, mcpServers: [{ ...TEST_SERVER, instructions: 'Its own' }, TEST_LOXONE_SERVER] },
            { version: '1.2.3' },
            []
        );

        expect(own.serverOptions).toEqual({ instructions: 'Its own' });
        expect(fallback.serverOptions).toEqual({ instructions: DEFAULT_INSTRUCTIONS });
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

    it('gives an unauthenticated endpoint only a pre-auth check: no issuer, so no metadata and no 401 challenge', () => {
        const [settings] = toMcpSettings({ ...CONFIG, mcpServers: [TEST_OPEN_SERVER] }, { version: '1.2.3' }, []);

        expect(settings.auth).toEqual({ preAuth: expect.any(Function) });
    });
});

describe('resourceOf', () => {
    it('joins the public URL and the path, whether or not the URL ends in a slash', () => {
        expect(resourceOf('https://mcp.irha.cz/kb', '/development')).toBe('https://mcp.irha.cz/kb/development');
        expect(resourceOf('https://mcp.irha.cz/kb/', '/development')).toBe('https://mcp.irha.cz/kb/development');
        expect(resourceOf('http://localhost:4004', '/development')).toBe('http://localhost:4004/development');
    });
});
