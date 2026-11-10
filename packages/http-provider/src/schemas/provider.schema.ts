import { ResilienceConfigSchema } from '@radoslavirha/resilience';
import { z } from 'zod';
import { AuthConfigSchema } from './auth.schema.js';

/**
 * HTTP statuses treated as transient by default — the ones worth retrying and
 * worth counting towards the circuit breaker. Add `429`/`408` per provider via
 * `retriableStatusCodes` when the upstream signals backpressure that way.
 */
export const DEFAULT_RETRIABLE_STATUS_CODES = [500, 502, 503, 504];

export const HttpProviderEntrySchema = z.object({
    baseURL: z.url().describe('Base URL every request path is resolved against.'),
    auth: AuthConfigSchema.optional(),
    // Full resilience config (timeout + retry + circuit breaker). Omit to run
    // requests unwrapped.
    resilience: ResilienceConfigSchema.optional()
        .describe('Timeout, retry and circuit breaker for requests to this API. Omit to send requests without them.'),
    // Which HTTP statuses count as transient failures for retry and the breaker.
    retriableStatusCodes: z.array(z.number().int()).default(DEFAULT_RETRIABLE_STATUS_CODES)
        .describe('HTTP statuses counted as transient failures, for retry and for the circuit breaker.')
});

/**
 * Config as **authored** — fields carrying a Zod default may be omitted, so this
 * is what a `config/*.json` file or a hand-written literal looks like.
 */
export type HttpProviderEntry = z.input<typeof HttpProviderEntrySchema>;

/**
 * Config as **parsed** — every defaulted field is resolved. `HttpProviderFactory`
 * works with this shape internally after running the entry through the schema.
 */
export type ResolvedHttpProviderEntry = z.output<typeof HttpProviderEntrySchema>;
