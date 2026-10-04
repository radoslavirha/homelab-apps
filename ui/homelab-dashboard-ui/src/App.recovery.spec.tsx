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

describe('<App /> recovery', () => {
    it('shows the DNS records once the controller recovers after a failed first load', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(dnsRecords), { status: 200 })));
        Object.assign(globalThis, { fetch: fetchMock });

        render(<App config={config} />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();

        // recovery probe succeeds, banner clears
        await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
        expect(fetchMock.mock.calls.length).toBeGreaterThan(1);

        expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
        expect(screen.getByText('app1')).toBeInTheDocument();
    });
});
