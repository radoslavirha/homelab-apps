import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QrCodeListPage } from './QrCodeListPage.js';
import { RuntimeConfigProvider } from '../runtime/RuntimeConfigContext.js';
import { ApiStatusProvider } from '../runtime/ApiStatusContext.js';
import type { RuntimeConfig } from '../runtime/RuntimeConfig.js';

vi.mock('@radoslavirha/ui-auth', () => ({ useAuth: () => ({ getAccessToken: () => 't' }) }));

const config = { apiBaseURL: 'http://api.test', basePath: '/' } as RuntimeConfig;
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const renderPage = () => render(
    <MemoryRouter>
        <RuntimeConfigProvider value={config}>
            <ApiStatusProvider report={vi.fn()}><QrCodeListPage /></ApiStatusProvider>
        </RuntimeConfigProvider>
    </MemoryRouter>
);

afterEach(() => vi.restoreAllMocks());

describe('QrCodeListPage', () => {
    it('shows an error rather than crashing when a 200 body has no items array', async () => {
        Object.assign(globalThis, { fetch: vi.fn().mockResolvedValue(json({})) });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        renderPage();
        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    });
});
