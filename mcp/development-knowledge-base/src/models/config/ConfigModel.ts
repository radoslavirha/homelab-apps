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
 * Phase 1 has no inbound login; inbound auth arrives in phase 2 as a required key, with no way
 * to switch it off.
 */
export const ConfigSchema = BaseConfig.extend({
    externalApis: createExternalApisSchema(Object.values(ExternalApi))
        .describe('APIs this server calls — base URL, auth, resilience and logging per API.'),
    mcpServers: createMcpServersSchema(Object.values(McpServer))
        .describe('The MCP endpoints this app mounts, by `McpServer` key.'),
    // What `list_knowledge_bases` says each knowledge base holds; the API knows ids and counts,
    // not what is in them. A knowledge base without an entry is listed without a description.
    knowledgeBases: z.record(z.string(), z.object({
        description: z.string().min(1).describe('What the knowledge base holds, written for an agent deciding whether to search it.')
    })).default({}).describe('Descriptions of the knowledge bases, by id.'),
    // Every field is defaulted, so omitting `health` entirely is valid — additive, and
    // safe for a rolling deploy where an old pod reads a new ConfigMap or vice versa.
    health: HealthConfigSchema.optional().describe('Health endpoint configuration.'),
    logger: LoggerOptionsSchema.optional(),
    otel: OtelConfigSchema.optional().describe('OpenTelemetry configuration.')
});
export type ConfigModel = z.infer<typeof ConfigSchema>;
