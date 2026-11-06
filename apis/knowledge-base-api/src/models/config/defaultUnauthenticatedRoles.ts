import { VerifierType } from '@radoslavirha/auth';
import { CommonUtils, ObjectUtils } from '@radoslavirha/utils';
import { ROLE_ADMIN, ROLE_EDITOR, ROLE_READER } from '../Roles.js';
import { AuthMethod } from './AuthMethod.enum.js';

/** Every role this API checks — what an `unauthenticated` `IDP` entry grants when it names none. */
const ALL_ROLES = [ROLE_READER, ROLE_EDITOR, ROLE_ADMIN];

/**
 * Runs before `createAuthConfigSchema`: an `unauthenticated` `IDP` entry without `roles` gets
 * every role this API checks. `@radoslavirha/auth` keeps `roles` required — this default is the
 * app's, because only the app knows its roles. Explicit `roles` win; anything else passes through
 * untouched, so the auth schema still reports it.
 */
export const defaultUnauthenticatedRoles = (value: unknown): unknown => {
    // Raw config: a plain object is all the guards below may assume.
    const auth = value as Record<string, unknown> | null | undefined;

    if (!ObjectUtils.isPlainObject(auth)) {
        return value;
    }

    const idp = auth[AuthMethod.Idp] as Record<string, unknown> | null | undefined;

    if (!ObjectUtils.isPlainObject(idp) || idp.type !== VerifierType.Unauthenticated || CommonUtils.notUndefined(idp.roles)) {
        return auth;
    }

    return { ...auth, [AuthMethod.Idp]: { ...idp, roles: [...ALL_ROLES] } };
};
