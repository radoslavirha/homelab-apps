import { describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from './fetchWithTimeout.js';

/** A fetch that never answers, and rejects with its signal's reason once that aborts. */
const hanging: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
});

describe('fetchWithTimeout', () => {
    it('aborts an attempt at its deadline with a TimeoutError, which Octokit retries', async () => {
        expect.assertions(1);

        await expect(fetchWithTimeout(20, hanging)('https://github.test/a')).rejects.toMatchObject({ name: 'TimeoutError' });
    });

    it('gives every attempt a deadline of its own, so a retry does not start already aborted', async () => {
        expect.assertions(2);

        const signals: AbortSignal[] = [];
        const answering: typeof fetch = (_input, init) => {
            signals.push(init!.signal!);

            return Promise.resolve(new Response('ok'));
        };
        const fetch = fetchWithTimeout(20, answering);

        await fetch('https://github.test/a');
        await new Promise((resolve) => setTimeout(resolve, 40));
        await fetch('https://github.test/a');

        expect(signals[0].aborted).toBe(true);
        expect(signals[1].aborted).toBe(false);
    });

    it('still aborts on the caller\'s signal, with an AbortError, which Octokit does not retry', async () => {
        expect.assertions(1);

        const caller = new AbortController();
        const attempt = fetchWithTimeout(10_000, hanging)('https://github.test/a', { signal: caller.signal });

        caller.abort(new DOMException('The pod is shutting down.', 'AbortError'));

        await expect(attempt).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('passes the request through untouched otherwise', async () => {
        expect.assertions(2);

        const answering = vi.fn<typeof fetch>().mockResolvedValue(new Response('body'));

        const response = await fetchWithTimeout(1000, answering)('https://github.test/a', { method: 'POST', headers: { a: 'b' } });

        expect(await response.text()).toBe('body');
        expect(answering).toHaveBeenCalledWith('https://github.test/a', expect.objectContaining({ method: 'POST', headers: { a: 'b' } }));
    });
});
