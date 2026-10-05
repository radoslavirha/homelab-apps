import { describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair } from 'jose';
import type { FetchImplementation } from 'jose';
import { RemoteJwksSource } from './RemoteJwksSource.js';
import { JwtVerifier } from '../verifiers/JwtVerifier.js';
import { TrustedIssuerSchema } from '../schemas/auth.schema.js';
import { mintTestToken } from '../test/mintTestToken.js';

const ISSUER = 'https://idp.test/application/o/app/';
const AUDIENCE = 'my-api';

const row = TrustedIssuerSchema.parse({
    name: 'idp',
    issuer: ISSUER,
    audience: AUDIENCE,
    key: { source: 'jwks', uri: 'https://idp.test/application/o/app/jwks/' }
});

const servingFetch = async (): Promise<FetchImplementation> => {
    const { publicKey } = await generateKeyPair('RS256', { extractable: true });
    const jwk = { ...(await exportJWK(publicKey)), kid: 'key-1', alg: 'RS256', use: 'sig' };
    return () => Promise.resolve(
        new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
};

describe('RemoteJwksSource — algorithm outside what a JWKS can serve', () => {
    it('reports an HS256 token against a reachable JWKS issuer as invalid, not indeterminate', async () => {
        const source = new RemoteJwksSource([row], { fetch: await servingFetch() });
        const verifier = new JwtVerifier([row], source);

        // The algorithm-confusion attempt: an HS256 token aimed at an RS256 JWKS issuer.
        const token = await mintTestToken({ issuer: ISSUER, audience: AUDIENCE });

        const outcome = await verifier.verify(token);

        expect(outcome).toMatchObject({ reason: 'invalid' });
    });

    it('reports an alg:none token against a reachable JWKS issuer as invalid, not indeterminate', async () => {
        const source = new RemoteJwksSource([row], { fetch: await servingFetch() });
        const verifier = new JwtVerifier([row], source);

        const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
        const token = `${b64({ alg: 'none' })}.${b64({ iss: ISSUER, aud: AUDIENCE, sub: 'x', exp: 9999999999 })}.`;

        const outcome = await verifier.verify(token);

        expect(outcome).toMatchObject({ reason: 'invalid' });
    });
});
