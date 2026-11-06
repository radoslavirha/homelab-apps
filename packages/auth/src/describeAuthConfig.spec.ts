import { describe, expect, it } from 'vitest';
import { describeAuthConfig } from './describeAuthConfig.js';
import { AuthConfigSchema } from './schemas/auth.schema.js';
import { VerifierType } from './VerifierType.js';
import { TEST_METHOD } from './test/FakeTokenVerifier.js';

const staticIssuer = {
    name: 'dev-local',
    issuer: 'dev',
    audience: 'qr-manager-api',
    subjectKind: 'service',
    key: { source: 'value', algorithm: 'HS256', value: 'local-dev-secret' }
};

const jwksIssuer = {
    name: 'idp',
    issuer: 'https://auth.irha.cz/application/o/app/',
    audience: 'app',
    key: { source: 'jwks', uri: 'https://auth.irha.cz/application/o/app/jwks/' }
};

const summaryOf = (...trustedIssuers: unknown[]) =>
    describeAuthConfig(AuthConfigSchema.parse({ [TEST_METHOD]: { type: VerifierType.BearerJwt, trustedIssuers } }));

describe('describeAuthConfig', () => {
    it('warns when no verifier is configured, because that state is otherwise invisible', () => {
        const summary = describeAuthConfig(AuthConfigSchema.parse({}));

        expect(summary.level).toBe('warn');
        expect(summary.message).toContain('no verifier is configured');
    });

    it('is informational once something can actually be verified', () => {
        expect(summaryOf(staticIssuer).level).toBe('info');
    });

    it('names the issuer and audience, which is the answer to "why is my token rejected"', () => {
        const summary = summaryOf(jwksIssuer);

        expect(summary.message).toContain('https://auth.irha.cz/application/o/app/');
        expect(summary.message).toContain('aud app');
        expect(summary.issuers[0]).toMatchObject({
            name: 'idp',
            issuer: 'https://auth.irha.cz/application/o/app/',
            audience: 'app',
            algorithms: ['RS256']
        });
    });

    it('describes where keys come from without ever printing one', () => {
        const summary = summaryOf(staticIssuer);

        expect(summary.issuers[0]?.keySource).toBe('inline HS256 key');
        // The secret is the whole credential. It must not reach a log line.
        expect(JSON.stringify(summary)).not.toContain('local-dev-secret');
    });

    it('marks a serviceaccount-authenticated JWKS, so the Kubernetes case is visible', () => {
        const summary = summaryOf({ ...jwksIssuer, key: { ...jwksIssuer.key, auth: 'serviceAccountToken' } });

        expect(summary.issuers[0]?.keySource).toContain('serviceaccount-authenticated');
    });

    it('lists every trusted issuer when there are several', () => {
        const summary = summaryOf(staticIssuer, jwksIssuer);

        expect(summary.issuers).toHaveLength(2);
        expect(summary.message).toContain('dev-local');
        expect(summary.message).toContain('idp');
    });
});

describe('describeAuthConfig — methods', () => {
    it('reports which named methods are configured', () => {
        expect(summaryOf(staticIssuer).methods).toEqual([TEST_METHOD]);
    });

    it('reports no methods when nothing is configured', () => {
        expect(describeAuthConfig(AuthConfigSchema.parse({})).methods).toEqual([]);
    });
});

describe('describeAuthConfig — unauthenticated methods', () => {
    const open = { type: VerifierType.Unauthenticated, roles: ['kb.reader', 'kb.editor'], defaultSubject: 'developer' };

    it('warns, and names the method and every role it grants, so an open method is never quiet at boot', () => {
        const summary = describeAuthConfig(AuthConfigSchema.parse({ OPEN: open }));

        expect(summary.level).toBe('warn');
        expect(summary.message).toBe(
            "auth — accepting OPEN; OPEN admits EVERY request without a credential as 'developer' with roles [kb.reader, kb.editor]."
        );
        expect(summary.unauthenticated).toEqual([
            { method: 'OPEN', roles: ['kb.reader', 'kb.editor'], defaultSubject: 'developer', subjectKind: 'human' }
        ]);
    });

    it('reports the unverified subject header when one is configured', () => {
        const summary = describeAuthConfig(AuthConfigSchema.parse({ OPEN: { ...open, subjectHeader: 'X-User' } }));

        expect(summary.unauthenticated[0]).toHaveProperty('subjectHeader', 'X-User');
    });

    it('still warns when an open method sits beside a verified one, and lists both', () => {
        const summary = describeAuthConfig(AuthConfigSchema.parse({
            [TEST_METHOD]: { type: VerifierType.BearerJwt, trustedIssuers: [jwksIssuer] },
            OPEN: open
        }));

        expect(summary.level).toBe('warn');
        expect(summary.message).toContain('trusting idp');
        expect(summary.message).toContain('OPEN admits EVERY request');
    });

    it('lists no unauthenticated methods when every entry verifies a credential', () => {
        expect(summaryOf(staticIssuer).unauthenticated).toEqual([]);
    });
});
