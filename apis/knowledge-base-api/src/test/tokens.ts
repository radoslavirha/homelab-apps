// Kept apart from `fakes.ts`: importing `@radoslavirha/tsed-auth` registers its `AuthenticationService`
// provider, which a unit spec on `PlatformTest.create` cannot build without the app's `AuthProvider`.
import { mintTestToken } from '@radoslavirha/tsed-auth';
import { ROLE_ADMIN, ROLE_EDITOR, ROLE_READER } from '../models/Roles.js';

export const readerToken = (): Promise<string> => mintTestToken({ claims: { roles: [ROLE_READER] } });

/** Editor inherits reader in Authentik, so the token carries both. */
export const editorToken = (): Promise<string> => mintTestToken({ claims: { roles: [ROLE_READER, ROLE_EDITOR] } });

export const adminToken = (): Promise<string> => mintTestToken({ claims: { roles: [ROLE_READER, ROLE_ADMIN] } });

export const noRoleToken = (): Promise<string> => mintTestToken({ claims: { roles: [] } });

/** The audience of a token minted for some other API; a refusal must not echo it back. */
export const FOREIGN_AUDIENCE = 'some-other-api';

/**
 * `Authorization` headers every route must refuse with 401, by what is wrong with them. Each
 * token carries every role, so only the credential itself can be the reason.
 */
export const refusedCredentials = async (): Promise<[reason: string, authorization: string][]> => {
    const claims = { roles: [ROLE_READER, ROLE_ADMIN] };

    return [
        ['a forged signature', `Bearer ${await mintTestToken({ secret: 'another-secret-not-real-0000000000', claims })}`],
        ['another audience', `Bearer ${await mintTestToken({ audience: FOREIGN_AUDIENCE, claims })}`],
        ['an expired token', `Bearer ${await mintTestToken({ expiresIn: '-5m', claims })}`],
        ['a non-bearer scheme', 'Basic dXNlcjpwYXNz']
    ];
};
