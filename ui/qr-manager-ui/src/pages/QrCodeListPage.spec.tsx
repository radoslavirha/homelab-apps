import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QrCodeListPage } from './QrCodeListPage.js';
import { RuntimeConfigProvider } from '../runtime/RuntimeConfigContext.js';
import { ApiStatusProvider } from '../runtime/ApiStatusContext.js';
import type { RuntimeConfig } from '../runtime/RuntimeConfig.js';

// Stable identity, like the real hook: an unstable getter would rebuild the client every render.
const auth = { getAccessToken: () => 't' };
vi.mock('@radoslavirha/ui-auth', () => ({ useAuth: () => auth }));

const config = { apiBaseURL: 'http://api.test', basePath: '/' } as RuntimeConfig;
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const active = { id: 'a1', slug: 'aaaa', label: 'Active one', type: 'plant', active: true };

const renderPage = () => render(
    <MemoryRouter>
        <RuntimeConfigProvider value={config}>
            <ApiStatusProvider report={vi.fn()}><QrCodeListPage /></ApiStatusProvider>
        </RuntimeConfigProvider>
    </MemoryRouter>
);

afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
});

describe('QrCodeListPage', () => {
    it('does not keep rows of the previous filter when the filtered request fails', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(json({ items: [active] }))
            .mockResolvedValueOnce(json({ message: 'boom' }, 500));
        Object.assign(globalThis, { fetch: fetchMock });
        renderPage();
        await screen.findByText('Active one');
        await userEvent.selectOptions(screen.getByLabelText('Active'), 'false');
        await screen.findByRole('alert');
        expect(screen.queryByText('Active one')).not.toBeInTheDocument();
    });

    it('shows an error rather than crashing when a 200 body has no items array', async () => {
        Object.assign(globalThis, { fetch: vi.fn().mockResolvedValue(json({})) });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        renderPage();
        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    });
});
