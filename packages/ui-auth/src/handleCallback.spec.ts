import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCallback } from './handleCallback.js';
import type { AuthClient } from './createAuthClient.js';

const client = (overrides: Record<string, unknown> = {}) =>
    ({
        signinRedirectCallback: vi.fn().mockResolvedValue({}),
        ...overrides
    } as unknown as AuthClient);

const at = (search: string) => window.history.replaceState(null, '', `/callback${search}`);

afterEach(() => window.history.replaceState(null, '', '/'));

describe('handleCallback', () => {
    it('completes a login', async () => {
        at('?code=abc&state=xyz');
        const c = client();

        await expect(handleCallback(c)).resolves.toMatchObject({ result: 'signed-in' });
        expect(c.signinRedirectCallback).toHaveBeenCalledOnce();
    });

    const errorResponse = (error: string, returnTo?: unknown) =>
        Object.assign(new Error(error), { error, state: returnTo === undefined ? undefined : { returnTo } });

    it('reports no-session for login_required, keeping the return path', async () => {
        // The prompt=none attempt made on load. Not an error: it is the IdP
        // saying nobody is signed in, and the caller renders a sign-in page.
        at('?error=login_required&state=xyz');
        const c = client({
            signinRedirectCallback: vi.fn().mockRejectedValue(errorResponse('login_required', '/qr/admin/671b'))
        });

        await expect(handleCallback(c)).resolves.toEqual({ result: 'no-session', returnTo: '/qr/admin/671b' });
    });

    it.each(['consent_required', 'interaction_required'])(
        'treats %s as no-session too — all three mean "interaction needed"',
        async error => {
            at(`?error=${error}&state=xyz`);
            const c = client({ signinRedirectCallback: vi.fn().mockRejectedValue(errorResponse(error)) });
            await expect(handleCallback(c)).resolves.toEqual({ result: 'no-session', returnTo: undefined });
        }
    );

    it('refuses an unsafe return path on no-session', async () => {
        at('?error=login_required&state=xyz');
        const c = client({
            signinRedirectCallback: vi.fn().mockRejectedValue(errorResponse('login_required', '//evil.test'))
        });

        await expect(handleCallback(c)).resolves.toEqual({ result: 'no-session', returnTo: undefined });
    });

    it('still reports no-session when the state entry is gone', async () => {
        at('?error=login_required&state=gone');
        const c = client({ signinRedirectCallback: vi.fn().mockRejectedValue(new Error('No matching state found')) });

        await expect(handleCallback(c)).resolves.toEqual({ result: 'no-session', returnTo: undefined });
    });

    it('reports failure for an error response that is not a missing session', async () => {
        at('?error=access_denied&state=xyz');
        const c = client({ signinRedirectCallback: vi.fn().mockRejectedValue(errorResponse('access_denied')) });

        await expect(handleCallback(c)).resolves.toEqual({ result: 'failed' });
    });

    it('returns where the user was, so a renewal does not lose their place', async () => {
        // Renewal is a redirect. Without this, every renewal drops whoever was
        // mid-task back on the landing page — roughly twice an hour.
        at('?code=abc&state=xyz');
        const c = client({
            signinRedirectCallback: vi.fn().mockResolvedValue({ state: { returnTo: '/admin/671b?active=true' } })
        });

        await expect(handleCallback(c)).resolves.toEqual({
            result: 'signed-in',
            returnTo: '/admin/671b?active=true'
        });
    });

    it.each(['//evil.test/phish', 'https://evil.test', 'admin', '', 42, undefined, null])(
        'refuses %p as a return path',
        async returnTo => {
            // The value survives a round trip through the IdP and comes back out
            // of browser storage, so it is untrusted. `//evil.test` is the one
            // that matters: a protocol-relative URL a browser follows off-site,
            // one leading slash away from a legitimate path.
            at('?code=abc&state=xyz');
            const c = client({ signinRedirectCallback: vi.fn().mockResolvedValue({ state: { returnTo } }) });

            await expect(handleCallback(c)).resolves.toEqual({ result: 'signed-in', returnTo: undefined });
        }
    );

    it('tolerates a missing state object', async () => {
        at('?code=abc&state=xyz');

        await expect(handleCallback(client())).resolves.toEqual({ result: 'signed-in', returnTo: undefined });
    });

    it('reports failure rather than throwing into the router', async () => {
        at('?code=abc&state=xyz');
        const c = client({ signinRedirectCallback: vi.fn().mockRejectedValue(new Error('invalid_grant')) });

        await expect(handleCallback(c)).resolves.toEqual({ result: 'failed' });
    });
});

describe('handleCallback — no session, real client', () => {
    it('keeps the return path when the prompt=none probe finds no session', async () => {
        const { createAuthClient } = await import('./createAuthClient.js');
        const issuer = 'https://auth.test/application/o/qr/';
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                Response.json({
                    issuer,
                    authorization_endpoint: 'https://auth.test/authorize',
                    token_endpoint: 'https://auth.test/token'
                })
            )
        );
        const c = createAuthClient({
            issuer,
            clientId: 'qr',
            scope: 'openid profile roles',
            redirectUri: 'http://localhost/callback',
            postLogoutRedirectUri: 'http://localhost/'
        });
        // What AuthProvider's recover()/renewal stores before leaving for the IdP.
        const request = await (
            c as unknown as { _client: { createSigninRequest(a: object): Promise<{ state: { id: string } }> } }
        )._client.createSigninRequest({
            request_type: 'si:r',
            redirect_uri: 'http://localhost/callback',
            response_type: 'code',
            scope: 'openid profile roles',
            prompt: 'none',
            state: { returnTo: '/qr-manager/admin/671b' }
        });
        at(`?error=login_required&state=${request.state.id}`);

        await expect(handleCallback(c)).resolves.toEqual({
            result: 'no-session',
            returnTo: '/qr-manager/admin/671b'
        });
        vi.unstubAllGlobals();
    });
});
