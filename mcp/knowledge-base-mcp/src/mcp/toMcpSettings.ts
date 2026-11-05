import type { APIInformation } from '@radoslavirha/tsed-configuration';
import { CommonUtils } from '@radoslavirha/utils';
import type { PlatformMcpSettings } from '@tsed/platform-mcp';
import { McpTokenVerifier } from '../auth/McpTokenVerifier.js';
import type { ConfigModel } from '../models/config/ConfigModel.js';

/** An endpoint's resource identifier: the public base URL (route prefix included) plus its path. */
export const resourceOf = (publicURL: string, path: string): string => `${publicURL.replace(/\/+$/, '')}${path}`;

/**
 * The `mcp` setting for Ts.ED: one endpoint per entry of `mcpServers` in the config.
 * Each serves `tools` (every class the tools barrel exports); the version is the app's own.
 *
 * Every endpoint is an OAuth resource server: platform-mcp serves its Protected Resource Metadata
 * at `/.well-known/oauth-protected-resource<path>` and answers a request without a valid token
 * with the `401` challenge pointing there. `McpTokenVerifier` decides.
 */
export const toMcpSettings = (
    config: Pick<ConfigModel, 'mcpServers' | 'publicURL'>,
    api: Pick<APIInformation, 'description' | 'version'>,
    tools: PlatformMcpSettings['tools']
): PlatformMcpSettings[] => Object.entries(config.mcpServers).map(([key, server]) => ({
    path: server.path,
    name: server.name,
    title: server.title,
    description: CommonUtils.isUndefined(server.description) ? api.description : server.description,
    version: api.version,
    tools,
    auth: {
        issuer: server.auth.issuer,
        resource: resourceOf(config.publicURL, server.path),
        scopesSupported: server.auth.scopes,
        resourceName: server.title,
        verifier: new McpTokenVerifier(key, server.auth)
    }
}));
