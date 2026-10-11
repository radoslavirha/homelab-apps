import { RedactionFieldOptionsSchema, RedactionSelectorSchema } from '@radoslavirha/redaction';
import { z } from 'zod';

/**
 * Headers redacted by default. Unlike inbound logging, an outbound request
 * carries credentials **this package itself injected** via the auth strategy, so
 * the safe default is to censor them rather than start from an empty list.
 *
 * `fast-redact` rejects hyphens in bare paths — hyphenated header names must use
 * bracket notation.
 */
export const DEFAULT_HEADER_REDACT_PATHS = [
    'authorization',
    'Authorization',
    'cookie',
    'Cookie',
    '["set-cookie"]',
    '["proxy-authorization"]',
    '["x-api-key"]'
];

/**
 * One redactable section of an outbound exchange. Same `{ enabled, redactPaths }`
 * vocabulary as `@radoslavirha/redaction`, but **disabled unless switched on** —
 * `createRedactionSchema` defaults every field to enabled, which would turn on
 * unredacted payload logging as soon as a `logging` block exists.
 */
const section = (redactPaths: string[]) => RedactionFieldOptionsSchema.extend({
    enabled: z.boolean().default(false),
    redactPaths: z.array(RedactionSelectorSchema).default(() => [...redactPaths])
}).default(() => ({ enabled: false, redactPaths: [...redactPaths] }));

const HttpLogSectionsSchema = z.object({
    headers: section(DEFAULT_HEADER_REDACT_PATHS),
    query: section([]),
    request: section([]),
    response: section([])
});

/**
 * Outbound HTTP logging options. Metadata-only by default; payload sections are
 * opt-in. Values are redacted before reaching the logger.
 */
export const HttpLogConfigSchema = HttpLogSectionsSchema.extend({
    /** Disable outbound request/response logging entirely. */
    enabled: z.boolean().default(true),
    /** Include the error stack on failed requests. */
    stack: z.boolean().default(false)
}).default(() => ({
    enabled: true,
    headers: { enabled: false, redactPaths: [] },
    query: { enabled: false, redactPaths: [] },
    request: { enabled: false, redactPaths: [] },
    response: { enabled: false, redactPaths: [] },
    stack: false
}));

export type HttpLogConfig = z.input<typeof HttpLogConfigSchema>;
export type ResolvedHttpLogConfig = z.output<typeof HttpLogConfigSchema>;
