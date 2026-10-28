import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_ROLES, TEST_SERVER, userToken } from '../test/fixtures.js';
import { McpTokenVerifier } from './McpTokenVerifier.js';

/** Resolves to the OAuth error code a verification failed with. */
const refusal = async (verification: Promise<unknown>): Promise<string> => {
    try {
        await verification;
    } catch (error) {
        return error instanceof OAuthError ? error.code : `not an OAuthError: ${String(error)}`;
    }

    return 'accepted';
};

const base64url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('McpTokenVerifier', () => {
    const verifier = new McpTokenVerifier('DEVELOPMENT_KB', TEST_SERVER.auth);

    // For the logger it writes refusals to.
    beforeEach(PlatformTest.create);
    afterEach(PlatformTest.reset);

    it('accepts a reader, with what the SDK needs and the principal for the per-tool check', async () => {
        expect.assertions(1);

        const token = await userToken({ subject: 'radoslav', claims: { azp: 'knowledge-base-mcp-clients', scope: 'openid profile email roles' } });

        await expect(verifier.verifyAccessToken(token)).resolves.toEqual({
            token,
            clientId: 'knowledge-base-mcp-clients',
            scopes: ['openid', 'profile', 'email', 'roles'],
            expiresAt: expect.any(Number),
            extra: { principal: expect.objectContaining({ subject: 'radoslav', kind: 'human', roles: [TEST_ROLES.READER], issuer: 'https://issuer.test/' }) }
        });
    });

    it('leaves out what the token does not carry: no client id, no scopes', async () => {
        expect.assertions(1);

        await expect(verifier.verifyAccessToken(await userToken())).resolves.toEqual(expect.objectContaining({ clientId: '', scopes: [] }));
    });

    it('accepts an editor, who holds both roles', async () => {
        expect.assertions(1);

        await expect(refusal(verifier.verifyAccessToken(await userToken({ claims: { roles: [TEST_ROLES.READER, TEST_ROLES.EDITOR] } })))).resolves.toBe('accepted');
    });

    it('refuses a good token holding none of the endpoint\'s roles with insufficient_scope (403): signing in again cannot help', async () => {
        expect.assertions(2);

        const verification = verifier.verifyAccessToken(await userToken({ claims: { roles: ['kb-home.reader'] } }));

        await expect(refusal(verification)).resolves.toBe(OAuthErrorCode.InsufficientScope);
        // Nothing about which role was wanted.
        await expect(verification).rejects.toThrow('Insufficient permissions.');
    });

    it.each([
        ['another issuer', { issuer: 'https://other-issuer.test/' }],
        ['another audience', { audience: 'kb-home-local' }],
        ['an expired token', { expiresIn: '-5m' }],
        ['another signing key', { secret: 'another-secret-not-a-real-key-0000' }]
    ])('refuses %s with invalid_token (401)', async (_case, options) => {
        expect.assertions(1);

        await expect(refusal(verifier.verifyAccessToken(await userToken(options)))).resolves.toBe(OAuthErrorCode.InvalidToken);
    });

    it('refuses something that is not a JWT at all with invalid_token, saying nothing about why', async () => {
        expect.assertions(1);

        await expect(verifier.verifyAccessToken('not-a-jwt')).rejects.toThrow(new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token.'));
    });

    it('answers server_error, not invalid_token, when the signing keys cannot be fetched: the token may be fine', async () => {
        expect.assertions(1);

        // Nothing listens on port 9; the fetch fails fast.
        const unreachable = new McpTokenVerifier('DEVELOPMENT_KB', {
            ...TEST_SERVER.auth,
            key: { source: 'jwks', uri: 'http://127.0.0.1:9/jwks/', auth: 'none', algorithms: ['RS256'], cacheTtlSeconds: 300, refreshCooldownMs: 30_000, timeoutMs: 500 }
        });
        const token = `${base64url({ alg: 'RS256', kid: 'k1' })}.${base64url({ iss: 'https://issuer.test/', aud: 'test-audience', sub: 's', exp: 9_999_999_999 })}.c2ln`;

        await expect(refusal(unreachable.verifyAccessToken(token))).resolves.toBe(OAuthErrorCode.ServerError);
    });
});
