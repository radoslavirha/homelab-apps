import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from './App.js';
import { AppConfigSchema } from './runtime/RuntimeConfig.js';

const config = AppConfigSchema.parse({
    unifi: { site: 'default' },
    serverPattern: '^server(\\d+)\\.home$'
});

const dnsRecords = [
    { key: 'server1.home', value: '192.168.1.10', record_type: 'A', enabled: true },
    { key: 'app1.home', value: '192.168.1.10', record_type: 'A', enabled: true }
];

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('<App /> offline/online blip while the controller is down', () => {
    it('still recovers once the controller answers', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('', { status: 503 }))
            .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(dnsRecords), { status: 200 })));
        Object.assign(globalThis, { fetch: fetchMock });

        render(<App config={config} />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.getByText(/Could not retrieve DNS records/)).toBeInTheDocument();

        await act(async () => {
            window.dispatchEvent(new Event('offline'));
            window.dispatchEvent(new Event('online'));
        });
        await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });

        expect(screen.getByText('app1')).toBeInTheDocument();
    });
});
