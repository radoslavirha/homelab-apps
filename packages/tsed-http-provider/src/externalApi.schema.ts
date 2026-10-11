import { HttpProviderEntrySchema } from '@radoslavirha/http-provider';
import { z } from 'zod';
import { HttpLogConfigSchema } from './logging.schema.js';

/**
 * Bracket-notation selector for a name taken from configuration. `fast-redact`
 * rejects bare hyphenated paths, and the spelling must match what is sent.
 */
function toSelector(name: string): string {
    return `[${JSON.stringify(name)}]`;
}

/**
 * A configured external API: everything `@radoslavirha/http-provider` needs
 * (base URL, auth, resilience, retriable statuses) plus the outbound logging
 * this package layers on top.
 *
 * The core package deliberately knows nothing about logging, so the `logging`
 * section is added here rather than there.
 */
export const ExternalApiEntrySchema = HttpProviderEntrySchema.extend({
    logging: HttpLogConfigSchema
}).transform((entry) => {
    const transport = entry.auth?.transport;
    const headerPaths = (transport?.headers ?? []).map((header) => toSelector(header.name));
    const queryPaths = (transport?.queryParams ?? []).map((param) => toSelector(param.name));

    if (headerPaths.length === 0 && queryPaths.length === 0) {
        return entry;
    }

    const { logging } = entry;

    return {
        ...entry,
        logging: {
            ...logging,
            headers: { ...logging.headers, redactPaths: [...new Set([...logging.headers.redactPaths, ...headerPaths])] },
            query: { ...logging.query, redactPaths: [...new Set([...logging.query.redactPaths, ...queryPaths])] }
        }
    };
});

/**
 * Builds a schema for an `externalApis` map constrained to the given enum keys,
 * so missing required keys fail at config load rather than at first call.
 *
 * Unknown extra keys are intentionally tolerated at runtime to keep rolling
 * deployments configuration-backward-compatible (new keys can be introduced in
 * config before every pod has been upgraded).
 *
 * @example
 * ```ts
 * enum ExternalApi { MiotSpec = 'miot-spec' }
 *
 * export const ConfigSchema = BaseConfig.extend({
 *   externalApis: createExternalApisSchema(Object.values(ExternalApi)).optional()
 * });
 * ```
 */
export function createExternalApisSchema<K extends string>(
    keys: K[]
): z.ZodObject<Record<K, typeof ExternalApiEntrySchema>> {
    const shape = Object.fromEntries(
        keys.map((key) => [key, ExternalApiEntrySchema])
    ) as Record<K, typeof ExternalApiEntrySchema>;

    return z.object(shape);
}

/** Config as authored — defaulted fields may be omitted. */
export type ExternalApiEntry = z.input<typeof ExternalApiEntrySchema>;

/** Config as parsed — every defaulted field resolved. */
export type ResolvedExternalApiEntry = z.output<typeof ExternalApiEntrySchema>;
