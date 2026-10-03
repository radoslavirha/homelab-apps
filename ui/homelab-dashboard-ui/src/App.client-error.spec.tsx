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

describe('<App /> recovery from a transient 4xx', () => {
    it.each([404, 429])('keeps retrying after HTTP %i and shows the records once the controller answers', async status => {
        vi.useFakeTimers();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('', { status }))
            .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(dnsRecords), { status: 200 })));
        Object.assign(globalThis, { fetch: fetchMock });

        render(<App config={config} />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.getByText(new RegExp(`HTTP ${status}`))).toBeInTheDocument();

        await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });

        expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
        expect(screen.getByText('app1')).toBeInTheDocument();
    });
});
