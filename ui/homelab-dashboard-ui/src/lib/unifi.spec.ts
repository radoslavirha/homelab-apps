import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCENT_COLORS, accentColor, fetchDnsRecords } from './unifi.js';
import type { AppConfig } from '../types.js';

describe('accentColor', () => {
    it('returns first color for index 1', () => {
        expect(accentColor(1)).toBe(ACCENT_COLORS[0]);
    });

    it('wraps around when index exceeds color array length', () => {
        expect(accentColor(ACCENT_COLORS.length + 1)).toBe(ACCENT_COLORS[0]);
    });

    it('returns second color for index 2', () => {
        expect(accentColor(2)).toBe(ACCENT_COLORS[1]);
    });
});

describe('fetchDnsRecords', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        vi.restoreAllMocks();
        Object.assign(globalThis, { fetch: originalFetch });
    });

    // The durable guard for the credential boundary: the key is attached by the
    // server-side hop (nginx proxy_set_header in production, the Vite proxy in
    // dev), never by the browser. This fails if a credential is reintroduced.
    it('sends no credential header from the browser', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
        );
        Object.assign(globalThis, { fetch: fetchMock });

        await fetchDnsRecords({ unifi: { site: 'default' } } as AppConfig);

        expect(fetchMock).toHaveBeenCalledWith('/proxy/network/v2/api/site/default/static-dns');
        // Exactly one argument: no init object at all is the strongest form of
        // "no headers were set".
        expect(fetchMock.mock.calls[0]).toHaveLength(1);
    });

    it.each([
        ['HTML (SPA fallback)', '<!doctype html><html></html>'],
        ['non-array JSON', '{"error":"nope"}']
    ])('does not report success for a 200 with %s', async (_name, body) => {
        Object.assign(globalThis, { fetch: vi.fn().mockResolvedValue(new Response(body, { status: 200 })) });
        const outcomes: { kind: string }[] = [];

        await expect(
            fetchDnsRecords({ unifi: { site: 'default' } } as AppConfig, { onOutcome: o => outcomes.push(o) })
        ).rejects.toThrow();

        expect(outcomes.at(-1)?.kind).not.toBe('success');
    });

    // The dashboard has no login; the key is server-side, so a rejected key must
    // not be reported as 'unauthorized' (which renders a "sign in again" banner).
    it.each([401, 403])('reports client-error, not unauthorized, for HTTP %i', async status => {
        Object.assign(globalThis, { fetch: vi.fn().mockResolvedValue(new Response(null, { status })) });
        const outcomes: { kind: string }[] = [];

        await expect(
            fetchDnsRecords({ unifi: { site: 'default' } } as AppConfig, { onOutcome: o => outcomes.push(o) })
        ).rejects.toThrow(/API key rejected/);

        expect(outcomes).toEqual([{ kind: 'client-error', status }]);
    });
});
