import { OtelConfigSchema } from '@radoslavirha/otel';
import { BaseConfig } from '@radoslavirha/tsed-configuration';
import { HealthConfigSchema } from '@radoslavirha/tsed-health';
import { LoggerOptionsSchema } from '@radoslavirha/tsed-logger';
import z from 'zod';

/**
 * Phase 1 has no inbound login and no upstream yet, so nothing here is required beyond
 * `BaseConfig`. The upstream (knowledge-base-api and its client credentials) arrives with the
 * MCP tools; inbound auth arrives in phase 2 as a required key, with no way to switch it off.
 */
export const ConfigSchema = BaseConfig.extend({
    // Every field is defaulted, so omitting `health` entirely is valid — additive, and
    // safe for a rolling deploy where an old pod reads a new ConfigMap or vice versa.
    health: HealthConfigSchema.optional().describe('Health endpoint configuration.'),
    logger: LoggerOptionsSchema.optional(),
    otel: OtelConfigSchema.optional().describe('OpenTelemetry configuration.')
});
export type ConfigModel = z.infer<typeof ConfigSchema>;
