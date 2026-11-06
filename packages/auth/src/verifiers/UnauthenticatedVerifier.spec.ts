import { describe, expect, it } from 'vitest';
import { credentialSourceOf } from '../CredentialSource.js';
import { UnauthenticatedVerifierSchema } from '../schemas/auth.schema.js';
import { VerifierType } from '../VerifierType.js';
import { UNAUTHENTICATED_ISSUER, UnauthenticatedVerifier } from './UnauthenticatedVerifier.js';

const verifierWith = (overrides: Record<string, unknown> = {}): UnauthenticatedVerifier =>
    new UnauthenticatedVerifier(UnauthenticatedVerifierSchema.parse({
        type: VerifierType.Unauthenticated,
        roles: ['kb.reader', 'kb.editor'],
        defaultSubject: 'developer',
        ...overrides
    }));

describe('UnauthenticatedVerifier', () => {
    it('admits a request with no credential as the configured principal', async () => {
        expect.assertions(1);

        const verifier = verifierWith();
        const outcome = await verifier.verify(verifier.extract(credentialSourceOf({})) ?? '');

        expect(outcome).toEqual({
            reason: 'ok',
            principal: { subject: 'developer', kind: 'human', roles: ['kb.reader', 'kb.editor'], issuer: UNAUTHENTICATED_ISSUER }
        });
    });

    it('ignores an Authorization header rather than rejecting it', async () => {
        expect.assertions(2);

        const verifier = verifierWith();
        const credential = verifier.extract(credentialSourceOf({ Authorization: 'Bearer not-a-jwt' }));
        const outcome = await verifier.verify(credential ?? '');

        expect(credential).toBeUndefined();
        expect(outcome).toHaveProperty('principal.subject', 'developer');
    });

    it('takes the subject from subjectHeader when it is present and well-formed', async () => {
        expect.assertions(1);

        const verifier = verifierWith({ subjectHeader: 'X-User' });
        const outcome = await verifier.verify(verifier.extract(credentialSourceOf({ 'x-user': 'jane.doe@example.com' })) ?? '');

        expect(outcome).toHaveProperty('principal.subject', 'jane.doe@example.com');
    });

    it.each([
        ['absent', undefined],
        ['empty', ''],
        ['carrying a newline', 'jane\nOn-Behalf-Of: root'],
        ['carrying a space', 'jane doe'],
        ['too long', 'a'.repeat(151)]
    ])('falls back to defaultSubject when the header is %s', async (_label, value) => {
        expect.assertions(1);

        const verifier = verifierWith({ subjectHeader: 'X-User' });
        const outcome = await verifier.verify(verifier.extract(credentialSourceOf({ 'X-User': value })) ?? '');

        expect(outcome).toHaveProperty('principal.subject', 'developer');
    });

    it('reads no header when the entry names none', () => {
        expect(verifierWith().extract(credentialSourceOf({ 'X-User': 'jane' }))).toBeUndefined();
    });

    it('stamps the configured subjectKind', async () => {
        expect.assertions(1);

        const outcome = await verifierWith({ subjectKind: 'service' }).verify('');

        expect(outcome).toHaveProperty('principal.kind', 'service');
    });

    it('hands out a copy of the roles, so a caller cannot change the configuration', async () => {
        expect.assertions(1);

        const verifier = verifierWith();
        const first = await verifier.verify('');
        (first as unknown as { principal: { roles: string[] } }).principal.roles.push('kb.admin');

        expect(await verifier.verify('')).toHaveProperty('principal.roles', ['kb.reader', 'kb.editor']);
    });
});
