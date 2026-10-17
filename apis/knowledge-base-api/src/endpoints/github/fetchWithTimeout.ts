import { CommonUtils } from '@radoslavirha/utils';

/**
 * `fetch` with a deadline per call, for Octokit's `request.fetch`.
 *
 * Octokit's retry and rate-limit plugins re-send a request with the same options. A timeout
 * passed as the request's `signal` would therefore span every attempt and every wait, and the
 * last retry would always start already aborted. Built into `fetch`, each attempt gets its own
 * deadline, and a rate-limit wait (which is not a fetch) is not counted at all.
 *
 * A deadline rejects with a `TimeoutError`, which Octokit retries like any network error. A
 * caller's own signal still aborts every attempt, with an `AbortError`, which Octokit does not
 * retry.
 */
export const fetchWithTimeout = (timeoutMs: number, fetchImpl: typeof fetch = globalThis.fetch): typeof fetch =>
    (input, init) => {
        const deadline = AbortSignal.timeout(timeoutMs);
        const caller = init?.signal;

        return fetchImpl(input, { ...init, signal: CommonUtils.isNil(caller) ? deadline : AbortSignal.any([caller, deadline]) });
    };
