import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App.js';
import { AppConfigSchema } from './runtime/RuntimeConfig.js';

afterEach(() => {
    vi.restoreAllMocks();
    document.title = '';
});

const renderApp = async (overrides: Record<string, unknown> = {}) => {
    Object.assign(globalThis, {
        fetch: vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    });
    const config = AppConfigSchema.parse({
        unifi: { site: 'default' },
        serverPattern: '^server(\\d+)\\.home$',
        ...overrides
    });

    render(<App config={config} />);
    await screen.findByText(/Loaded 0 DNS records/);
};

describe('<App /> browser tab title', () => {
    it('sets document.title from config.title (README: "Browser tab title")', async () => {
        await renderApp({ title: 'My Lab' });

        expect(document.title).toBe('My Lab');
    });

    it('falls back to the default title when config.title is unset', async () => {
        await renderApp();

        expect(document.title).toBe('Homelab dashboard');
    });
});
