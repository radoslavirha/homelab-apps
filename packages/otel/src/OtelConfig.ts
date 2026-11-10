import { z } from 'zod';

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
