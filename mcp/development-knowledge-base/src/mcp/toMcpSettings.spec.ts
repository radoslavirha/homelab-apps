import { describe, expect, it } from 'vitest';
import { toMcpSettings } from './toMcpSettings.js';

class SomeTool {}

const SERVERS = { mcpServers: { DEVELOPMENT_KB: { path: '/development', name: 'development-kb', title: 'Development knowledge base' } } };

describe('toMcpSettings', () => {
    it('mounts one endpoint per MCP server, at its configured path, with the tools and the app version', () => {
        expect(toMcpSettings(SERVERS, { description: 'From package.json', version: '1.2.3' }, [SomeTool])).toEqual([{
            path: '/development',
            name: 'development-kb',
            title: 'Development knowledge base',
            description: 'From package.json',
            version: '1.2.3',
            tools: [SomeTool]
        }]);
    });

    it('prefers the server\'s own description over the package one', () => {
        const [settings] = toMcpSettings(
            { mcpServers: { DEVELOPMENT_KB: { ...SERVERS.mcpServers.DEVELOPMENT_KB, description: 'Its own' } } },
            { description: 'From package.json', version: '1.2.3' },
            []
        );

        expect(settings.description).toBe('Its own');
    });
});
