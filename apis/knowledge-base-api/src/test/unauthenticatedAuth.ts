// Kept apart from `fakes.ts` for the reason `tokens.ts` is: importing `@radoslavirha/tsed-auth`
// registers its `AuthenticationService` provider, which a unit spec cannot build.
import { createAuthConfigSchema, VerifierType } from '@radoslavirha/auth';
import { AuthenticationService } from '@radoslavirha/tsed-auth';
import { AuthMethod } from '../models/config/AuthMethod.enum.js';

/** The subject every request gets when it sends no `X-User` label. */
export const UNAUTHENTICATED_SUBJECT = 'developer';

/** The unverified header the entry reads a subject label from. */
export const UNAUTHENTICATED_SUBJECT_HEADER = 'X-User';

/**
 * A `PlatformTest.bootstrap` import that replaces the app's `AuthProvider` with an
 * `unauthenticated` `IDP` entry granting `roles` — the config a deployment without an IdP sets,
 * parsed by the same schema `ConfigModel` uses.
 */
export const unauthenticatedAuth = (roles: string[]): { token: typeof AuthenticationService; use: AuthenticationService } => ({
    token: AuthenticationService,
    use: new AuthenticationService(createAuthConfigSchema(Object.values(AuthMethod)).parse({
        [AuthMethod.Idp]: {
            type: VerifierType.Unauthenticated,
            roles,
            defaultSubject: UNAUTHENTICATED_SUBJECT,
            subjectHeader: UNAUTHENTICATED_SUBJECT_HEADER
        }
    }))
});
