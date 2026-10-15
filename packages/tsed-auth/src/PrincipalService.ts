import type { Principal } from '@radoslavirha/auth';
import { CommonUtils } from '@radoslavirha/utils';
import { getContext, Injectable, ProviderScope, Scope } from '@tsed/di';
import { Unauthorized } from '@tsed/exceptions';
import type { PlatformContext } from '@tsed/platform-http';
import { principalOf } from './AuthGuard.js';

/**
 * The principal of the request being handled, for whichever provider needs it.
 *
 * A service that decides what the caller may see asks for the principal itself, rather than
 * having a controller read it with `@CurrentPrincipal()` and hand it down through every handler
 * in between. Ts.ED keeps the request context in async-local storage for the whole request, so a
 * `SINGLETON` reads the right caller on every call.
 */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class PrincipalService {
    /**
     * The verified caller, or `undefined` when there is none: outside a request (a scheduled job,
     * a startup hook) and on an `@Anonymous()` route the caller sent no credential to.
     */
    public current(): Principal | undefined {
        const ctx = getContext<PlatformContext>();

        return CommonUtils.isUndefined(ctx) ? undefined : principalOf(ctx);
    }

    /**
     * The verified caller, for code that only runs behind `@Authenticate()`. The guard has already
     * refused a request without one, so the `401` here is a safe failure, not a second check.
     */
    public require(): Principal {
        const principal = this.current();

        if (CommonUtils.isUndefined(principal)) {
            throw new Unauthorized('Authentication required.');
        }

        return principal;
    }
}
