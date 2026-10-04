// ui/qr-manager-ui/src/pages/QrCodeDetailPage.spec.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QrCodeDetailPage } from './QrCodeDetailPage.js';
import { RuntimeConfigProvider } from '../runtime/RuntimeConfigContext.js';
import { ApiStatusProvider } from '../runtime/ApiStatusContext.js';
import type { RuntimeConfig } from '../runtime/RuntimeConfig.js';

// The real provider rebuilds getAccessToken whenever the user (token) is renewed.
let auth = { getAccessToken: () => 't1' };
vi.mock('@radoslavirha/ui-auth', () => ({ useAuth: () => auth }));

const config = { apiBaseURL: 'http://api.test', basePath: '/' } as RuntimeConfig;
const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const qr = {
    id: 'a1', slug: 'aaaa', label: 'Original', type: 'plant', active: true,
    targetURL: 'https://example.com', qrURL: 'http://x/r/aaaa', createdAt: 'c', updatedAt: 'u'
};

const tree = () => (
    <MemoryRouter initialEntries={['/admin/a1']}>
        <RuntimeConfigProvider value={config}>
            <ApiStatusProvider report={vi.fn()}>
                <Routes><Route path="/admin/:id" element={<QrCodeDetailPage />} /></Routes>
            </ApiStatusProvider>
        </RuntimeConfigProvider>
    </MemoryRouter>
);

afterEach(() => {
    vi.restoreAllMocks();
});

describe('QrCodeDetailPage', () => {
    it('keeps unsaved edits when the access token is renewed', async () => {
        Object.assign(globalThis, { fetch: vi.fn().mockImplementation(() => Promise.resolve(json({ items: [qr] }))) });
        const { rerender } = render(tree());
        const label = await screen.findByLabelText('Label');
        await userEvent.clear(label);
        await userEvent.type(label, 'Edited');

        auth = { getAccessToken: () => 't2' }; // silent renewal → new getter identity
        rerender(tree());
        await new Promise(r => setTimeout(r, 50));

        expect(screen.getByLabelText('Label')).toHaveValue('Edited');
    });
});
