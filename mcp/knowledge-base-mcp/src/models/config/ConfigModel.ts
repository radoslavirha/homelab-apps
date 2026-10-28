import { OtelConfigSchema } from '@radoslavirha/otel';
import { BaseConfig } from '@radoslavirha/tsed-configuration';
import { HealthConfigSchema } from '@radoslavirha/tsed-health';
import { createExternalApisSchema } from '@radoslavirha/tsed-http-provider';
import { LoggerOptionsSchema } from '@radoslavirha/tsed-logger';
import z from 'zod';
import { ExternalApi } from './ExternalApi.enum.js';
import { McpServer } from './McpServer.enum.js';
import { createMcpServersSchema } from './McpServerConfig.js';

/**
 * Every endpoint carries its own required `auth`; there is no way to switch it off.
 */
export const ConfigSchema = BaseConfig.extend({
    // Required here, optional in BaseConfig: each endpoint's resource identifier is this plus its
    // `path`, and platform-mcp never derives it from the request's Host header.
    publicURL: z.url().describe('Public base URL of the app: scheme, host and the route prefix, no endpoint path — `https://mcp.irha.cz/kb` deployed, `http://localhost:4004` locally. An endpoint\'s resource identifier is this plus its `path`.'),
    externalApis: createExternalApisSchema(Object.values(ExternalApi))
        .describe('APIs this server calls — base URL, auth, resilience and logging per API.'),
    mcpServers: createMcpServersSchema(Object.values(McpServer))
        .describe('The MCP endpoints this app mounts, by `McpServer` key, each serving one knowledge base.'),
    // Every field is defaulted, so omitting `health` entirely is valid — additive, and
    // safe for a rolling deploy where an old pod reads a new ConfigMap or vice versa.
    health: HealthConfigSchema.optional().describe('Health endpoint configuration.'),
    logger: LoggerOptionsSchema.optional(),
    otel: OtelConfigSchema.optional().describe('OpenTelemetry configuration.')
});
export type ConfigModel = z.infer<typeof ConfigSchema>;
