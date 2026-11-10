import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { z } from 'zod';

/** Set by the app from `serviceName` and package.json; config may not override them. */
const RESERVED_RESOURCE_ATTRIBUTES: readonly string[] = [ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION];

const OtelResourceAttributesSchema = z.record(z.string().min(1), z.union([z.string(), z.number(), z.boolean()]))
    .refine(
        (attributes) => Object.keys(attributes).every((key) => !RESERVED_RESOURCE_ATTRIBUTES.includes(key)),
        { message: `${ RESERVED_RESOURCE_ATTRIBUTES.join(' and ') } are set by the app and cannot be overridden here.` }
    );

const OtelExporterSchema = z.object({
    url: z.string().describe('OTLP/HTTP exporter endpoint URL.')
});

const OtelTracesConfigSchema = z.union([
    z.object({
        enabled: z.literal(true),
        exporter: OtelExporterSchema.describe('OTLP/HTTP exporter configuration. Required when traces are enabled.')
    }),
    z.object({
        enabled: z.literal(false).optional(),
        exporter: OtelExporterSchema.optional()
    })
]);

const OtelMetricsConfigSchema = z.union([
    z.object({
        enabled: z.literal(true),
        exporter: OtelExporterSchema.describe('OTLP/HTTP exporter configuration. Required when metrics are enabled.')
    }),
    z.object({
        enabled: z.literal(false).optional(),
        exporter: OtelExporterSchema.optional()
    })
]);

const OtelLogsConfigSchema = z.union([
    z.object({
        enabled: z.literal(true),
        exporter: OtelExporterSchema.describe('OTLP/HTTP exporter configuration. Required when logs are enabled.')
    }),
    z.object({
        enabled: z.literal(false).optional(),
        exporter: OtelExporterSchema.optional()
    })
]);

export const OtelConfigSchema = z.object({
    debug: z.boolean().optional().describe('Enable OTEL SDK debug logging via DiagConsoleLogger.'),
    resourceAttributes: OtelResourceAttributesSchema.optional()
        .describe('Extra resource attributes on every span, metric and log record, e.g. `{ "deployment.environment.name": "production" }`. '
            + 'Values are strings, numbers or booleans. `service.name` and `service.version` are not allowed.'),
    traces: OtelTracesConfigSchema.optional()
        .describe('Trace export over OTLP/HTTP (batched). Omitted or disabled: no traces are exported.'),
    metrics: OtelMetricsConfigSchema.optional()
        .describe('Metric export over OTLP/HTTP (periodic). Omitted or disabled: no metrics are exported.'),
    logs: OtelLogsConfigSchema.optional()
        .describe('Log record export over OTLP/HTTP (batched). Omitted or disabled: no log records are exported.')
});

export type OTELConfig = z.infer<typeof OtelConfigSchema>;
export type OTELTracesConfig = z.infer<typeof OtelTracesConfigSchema>;
export type OTELMetricsConfig = z.infer<typeof OtelMetricsConfigSchema>;
export type OTELLogsConfig = z.infer<typeof OtelLogsConfigSchema>;
