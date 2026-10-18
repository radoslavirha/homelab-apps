import type { APIInformation } from '@radoslavirha/tsed-configuration';
import { CommonUtils } from '@radoslavirha/utils';
import type { PlatformMcpSettings } from '@tsed/platform-mcp';
import type { ConfigModel } from '../models/config/ConfigModel.js';
import { McpServer } from '../models/config/McpServer.enum.js';

/**
 * The `mcp` setting for Ts.ED: one endpoint per `McpServer`, from `mcpServers` in the config.
 * Each serves `tools` (every class the tools barrel exports); the version is the app's own.
 */
export const toMcpSettings = (
    config: Pick<ConfigModel, 'mcpServers'>,
    api: Pick<APIInformation, 'description' | 'version'>,
    tools: PlatformMcpSettings['tools']
): PlatformMcpSettings[] => Object.values(McpServer).map((key) => {
    const server = config.mcpServers[key];

    return {
        path: server.path,
        name: server.name,
        title: server.title,
        description: CommonUtils.isUndefined(server.description) ? api.description : server.description,
        version: api.version,
        tools
    };
});
