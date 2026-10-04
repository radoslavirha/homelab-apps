import { describe, expect, it } from 'vitest';
import { StaticKeySource } from '../keys/StaticKeySource.js';
import { AuthConfigSchema } from '../schemas/auth.schema.js';
import { JwtVerifier } from './JwtVerifier.js';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('JwtVerifier with a malformed static PEM', () => {
    it('does not report a configuration fault as indeterminate (503)', async () => {
        const issuers = AuthConfigSchema.parse({ IDP: { type: 'bearer-jwt', trustedIssuers: [{
            name: 'a', issuer: 'iss', audience: 'aud',
            key: { source: 'value', algorithm: 'RS256', value: 'not a pem' } }] } }).IDP!.trustedIssuers;
        const verifier = new JwtVerifier(issuers, new StaticKeySource(issuers));
        const token = `${b64({ alg: 'RS256' })}.${b64({ iss: 'iss' })}.c2ln`;

        expect((await verifier.verify(token)).reason).not.toBe('indeterminate');
    });
});
