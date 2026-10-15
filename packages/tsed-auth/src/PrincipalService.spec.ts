import type { Principal } from '@radoslavirha/auth';
import { CommonUtils } from '@radoslavirha/utils';
import { DIContext, DITest, runInContext } from '@tsed/di';
import { Unauthorized } from '@tsed/exceptions';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PRINCIPAL_CONTEXT_KEY } from './AuthGuard.js';
import { AuthenticationService } from './AuthenticationService.js';
import { PrincipalService } from './PrincipalService.js';

const principal: Principal = {
    subject: 'radoslav',
    kind: 'human',
    roles: ['qr-manager.admin'],
    issuer: 'https://idp.test/'
};

/** A request context as the guard leaves it: the principal parked, or nothing when none was verified. */
const requestHolding = (verified?: Principal): DIContext => {
    const ctx = new DIContext({ id: 'request' });

    if (CommonUtils.notUndefined(verified)) {
        ctx.set(PRINCIPAL_CONTEXT_KEY, verified);
    }

    return ctx;
};

describe('PrincipalService', () => {
    let principals: PrincipalService;

    // Importing the guard registers `AuthenticationService`, which only an app's config can build
    // (see its own doc). Nothing here authenticates, so an empty stand-in satisfies the container.
    beforeEach(() => DITest.create({ imports: [{ token: AuthenticationService, use: {} }] }));
    beforeEach(() => {
        principals = DITest.get<PrincipalService>(PrincipalService);
    });
    afterEach(() => DITest.reset());

    describe('current', () => {
        it('returns the principal the guard parked on the request being handled', async () => {
            expect.assertions(1);

            await expect(runInContext(requestHolding(principal), () => principals.current())).resolves.toEqual(principal);
        });

        it('returns undefined on a request nobody was verified on', async () => {
            expect.assertions(1);

            await expect(runInContext(requestHolding(), () => principals.current())).resolves.toBeUndefined();
        });

        it('returns undefined outside a request', () => {
            // A scheduled job or a startup hook has no caller, and must not inherit one.
            expect(principals.current()).toBeUndefined();
        });
    });

    describe('require', () => {
        it('returns the verified caller', async () => {
            expect.assertions(1);

            await expect(runInContext(requestHolding(principal), () => principals.require())).resolves.toEqual(principal);
        });

        it('answers 401 when there is no caller, rather than a stand-in', async () => {
            expect.assertions(2);

            const refusal = runInContext(requestHolding(), () => principals.require());

            await expect(refusal).rejects.toBeInstanceOf(Unauthorized);
            await expect(refusal).rejects.toThrow('Authentication required.');
        });
    });
});
