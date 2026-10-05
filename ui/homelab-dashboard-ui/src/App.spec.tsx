import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.js';
import { AppConfigSchema } from './runtime/RuntimeConfig.js';

// Built through the real schema so fixtures cannot drift from what the app
// will actually be handed at runtime.
const config = AppConfigSchema.parse({
    title: 'test-lab',
    unifi: { site: 'default' },
    serverPattern: '^server(\\d+)\\.home$',
    scheme: 'http'
});

const dnsRecords = [
    { key: 'server1.home', value: '192.168.1.10', record_type: 'A', enabled: true },
    { key: 'app1.home', value: '192.168.1.10', record_type: 'A', enabled: true },
    { key: 'traefik.home', value: '192.168.1.10', record_type: 'A', enabled: true }
];

function mockFetch(records = dnsRecords) {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(records), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    );
    Object.assign(globalThis, { fetch: fetchMock });
    return fetchMock;
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.title = '';
});

describe('<App />', () => {
    it('renders header with correct title', async () => {
        mockFetch();
        render(<App config={config} />);
        expect(screen.getByText('test-lab')).toBeInTheDocument();
    });

    it('shows loading status while fetching', () => {
        const fetchMock = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
        Object.assign(globalThis, { fetch: fetchMock });

        render(<App config={config} />);
        expect(screen.getByText(/Fetching DNS records/i)).toBeInTheDocument();
    });

    it('renders cluster sections after successful fetch', async () => {
        mockFetch();
        render(<App config={config} />);

        await waitFor(() => expect(screen.getByText(/server1/)).toBeInTheDocument());
        expect(screen.getByText('app1')).toBeInTheDocument();
        expect(screen.getByText('traefik')).toBeInTheDocument();
    });

    it('shows error status when fetch fails', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
        Object.assign(globalThis, { fetch: fetchMock });

        render(<App config={config} />);
        await waitFor(() => expect(screen.getByText(/API key rejected/i)).toBeInTheDocument());
    });

    it('filters services by search query', async () => {
        mockFetch();
        render(<App config={config} />);

        await waitFor(() => expect(screen.getByText('app1')).toBeInTheDocument());

        const search = screen.getByPlaceholderText('Filter services…');
        await userEvent.type(search, 'traefik');

        expect(screen.getByText('traefik')).toBeInTheDocument();
        expect(screen.queryByText('app1')).not.toBeInTheDocument();
    });

    it('shows "no matches found" when filter yields no results', async () => {
        mockFetch();
        render(<App config={config} />);

        await waitFor(() => expect(screen.getByText('app1')).toBeInTheDocument());

        const search = screen.getByPlaceholderText('Filter services…');
        await userEvent.type(search, 'xyznonexistent');

        expect(screen.getByText('no matches found')).toBeInTheDocument();
    });

    it('uses default title "Homelab dashboard" when config.title is not set', async () => {
        mockFetch([]);
        const cfgNoTitle = AppConfigSchema.parse({ unifi: config.unifi, serverPattern: config.serverPattern });
        render(<App config={cfgNoTitle} />);
        await waitFor(() => expect(screen.getByText('Homelab dashboard')).toBeInTheDocument());
    });

    describe('browser tab title', () => {
        it('sets document.title from config.title (README: "Browser tab title")', async () => {
            mockFetch([]);
            render(<App config={AppConfigSchema.parse({ unifi: config.unifi, serverPattern: config.serverPattern, title: 'My Lab' })} />);
            await screen.findByText(/Loaded 0 DNS records/);

            expect(document.title).toBe('My Lab');
        });

        it('falls back to the default title when config.title is unset', async () => {
            mockFetch([]);
            render(<App config={AppConfigSchema.parse({ unifi: config.unifi, serverPattern: config.serverPattern })} />);
            await screen.findByText(/Loaded 0 DNS records/);

            expect(document.title).toBe('Homelab dashboard');
        });
    });

    describe('recovery', () => {
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

        it('still recovers after an offline/online blip while the controller is down', async () => {
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
});
