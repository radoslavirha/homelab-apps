import { EventEmitter } from 'node:events';
import type { PlatformContext } from '@tsed/platform-http';
import { describe, expect, it } from 'vitest';
import { getRequestSignal } from './getRequestSignal.js';

/**
 * Minimal stand-in for `PlatformContext`: the Map-like accessors the helper
 * memoises through, plus the raw request it binds its listeners to.
 */
function buildContext(raw: EventEmitter | undefined, res?: EventEmitter): PlatformContext {
    const store = new Map<string, unknown>();
    return {
        request: { raw },
        response: { raw: res },
        get: (key: string) => store.get(key),
        set: (key: string, value: unknown) => store.set(key, value)
    } as unknown as PlatformContext;
}

describe('getRequestSignal', () => {
    it('returns a non-aborted signal for a live request', () => {
        const signal = getRequestSignal(buildContext(new EventEmitter()));

        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal.aborted).toBe(false);
    });

    it('memoises the signal per context', () => {
        const ctx = buildContext(new EventEmitter());

        expect(getRequestSignal(ctx)).toBe(getRequestSignal(ctx));
    });

    it('does not abort when the request closes after its body was consumed', () => {
        const raw = new EventEmitter();
        const signal = getRequestSignal(buildContext(raw));

        raw.emit('close');
        expect(signal.aborted).toBe(false);
    });

    it('aborts when the response closes before it was sent', () => {
        const res = Object.assign(new EventEmitter(), { writableEnded: false });
        const signal = getRequestSignal(buildContext(new EventEmitter(), res));

        res.emit('close');
        expect(signal.aborted).toBe(true);
    });

    it('does not abort when the response closes after it was sent', () => {
        const res = Object.assign(new EventEmitter(), { writableEnded: true });
        const signal = getRequestSignal(buildContext(new EventEmitter(), res));

        res.emit('close');
        expect(signal.aborted).toBe(false);
    });

    it('aborts when the client disconnects mid-flight', () => {
        const raw = new EventEmitter();
        const signal = getRequestSignal(buildContext(raw));

        raw.emit('aborted');
        expect(signal.aborted).toBe(true);
    });

    it('aborts only once when both events fire', () => {
        const raw = new EventEmitter();
        const res = Object.assign(new EventEmitter(), { writableEnded: false });
        const ctx = buildContext(raw, res);
        const sig = getRequestSignal(ctx);

        raw.emit('aborted');
        res.emit('close');
        expect(sig.aborted).toBe(true);
    });

    it('tolerates a context without a raw request', () => {
        const signal = getRequestSignal(buildContext(undefined));

        expect(signal.aborted).toBe(false);
    });
});
