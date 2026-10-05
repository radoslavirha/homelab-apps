import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App.js';
import { AppConfigSchema } from './runtime/RuntimeConfig.js';

const config = AppConfigSchema.parse({
    unifi: { site: 'default' },
    serverPattern: '^server(\\d+)\\.home$'
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('<App /> with a rejected Unifi API key', () => {
    it.each([401, 403])('does not tell the viewer to sign in after HTTP %i', async status => {
        Object.assign(globalThis, { fetch: vi.fn().mockResolvedValue(new Response(null, { status })) });

        render(<App config={config} />);
        await waitFor(() => expect(screen.getByText(/API key rejected/i)).toBeInTheDocument());

        // The dashboard has no login; the key is server-side. The banner must
        // not blame a session the viewer does not have.
        expect(screen.queryByText(/sign in again/i)).not.toBeInTheDocument();
    });
});
