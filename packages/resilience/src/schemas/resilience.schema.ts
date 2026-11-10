import { z } from 'zod';

/**
 * Maximum time a single `execute()` is allowed to run before the operation is
 * aborted (via AbortSignal) and the call rejects.
 */
export const TimeoutConfigSchema = z.object({
    ms: z.number().int().min(0).default(5000)
        .describe('Time limit for one attempt, in ms. When it runs out the attempt is aborted through its AbortSignal and rejects.')
});

/**
 * Retry policy. `count` is the number of *additional* attempts after the first
 * (0 disables retry). `backoffMs` is the constant delay between attempts.
 */
export const RetryConfigSchema = z.object({
    count: z.number().int().min(0).default(0)
        .describe('Additional attempts after the first one. `0` disables retry.'),
    backoffMs: z.number().int().min(0).default(250)
        .describe('Constant delay between attempts, in ms.')
});

/**
 * Circuit breaker policy. Uses a sampling breaker: the circuit opens when the
 * error ratio exceeds `threshold` over the trailing `samplingDurationMs`
 * window, provided there were at least `minimumThroughput` calls per second.
 */
export const CircuitBreakerConfigSchema = z.object({
    halfOpenAfterMs: z.number().int().min(0).default(10000)
        .describe('How long the circuit stays open, in ms, before one trial call is let through (half-open).'),
    threshold: z.number().gt(0).lt(1).default(0.5)
        .describe('Error ratio over the sampling window above which the circuit opens.'),
    samplingDurationMs: z.number().int().min(1).default(10000)
        .describe('Length of the trailing window the error ratio is measured over, in ms.'),
    minimumThroughput: z.number().int().min(1).default(5)
        .describe('Calls per second the window must average before the circuit may open at all.')
});

/**
 * Full resilience configuration. Every section is optional — omit a section to
 * disable that policy. Composed as retry → circuit breaker → timeout.
 */
export const ResilienceConfigSchema = z.object({
    timeout: TimeoutConfigSchema.optional()
        .describe('Per-attempt timeout. Omit to disable.'),
    retry: RetryConfigSchema.optional()
        .describe('Retry policy. Omit to disable. Retries wrap the circuit breaker and the timeout, so each attempt gets its own timeout.'),
    circuitBreaker: CircuitBreakerConfigSchema.optional()
        .describe('Sampling circuit breaker. Omit to disable; `{}` enables it with the defaults.')
});

export type TimeoutConfig = z.infer<typeof TimeoutConfigSchema>;
export type RetryConfig = z.infer<typeof RetryConfigSchema>;
export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

/**
 * Public config shape. Uses the schema's **input** type so callers may omit
 * defaulted fields — e.g. `{ circuitBreaker: {} }` to enable the breaker with
 * all defaults. `createResiliencePolicy` parses this to apply defaults.
 */
export type ResilienceConfig = z.input<typeof ResilienceConfigSchema>;
