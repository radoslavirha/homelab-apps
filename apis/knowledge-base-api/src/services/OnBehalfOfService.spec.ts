import { UNAUTHENTICATED_ISSUER, type Principal } from '@radoslavirha/auth';
import { PrincipalService } from '@radoslavirha/tsed-auth';
import { BadRequest, Unauthorized } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// registers the AuthenticationService override bound to this API's config
import '../providers/AuthProvider.js';
import { OnBehalfOfService } from './OnBehalfOfService.js';

const verified: Principal = { subject: 'ak-development-kb-mcp-client_credentials', kind: 'service', roles: [], issuer: 'https://issuer.test/' };
const unauthenticated: Principal = { subject: 'developer', kind: 'human', roles: [], issuer: UNAUTHENTICATED_ISSUER };

describe('OnBehalfOfService', () => {
    let author: OnBehalfOfService;
    let principals: PrincipalService;

    const callerIs = (principal: Principal): void => {
        vi.spyOn(principals, 'require').mockReturnValue(principal);
    };

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        principals = PlatformTest.get<PrincipalService>(PrincipalService);
        author = PlatformTest.get<OnBehalfOfService>(OnBehalfOfService);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('behind an IdP', () => {
        beforeEach(() => callerIs(verified));

        it('takes the header the caller sent', () => {
            expect(author.resolve('akadmin')).toBe('akadmin');
        });

        it('refuses an absent header: a service account\'s sub is nobody\'s username', () => {
            expect(() => author.resolve(undefined)).toThrow(BadRequest);
        });
    });

    describe('under an unauthenticated auth entry', () => {
        beforeEach(() => callerIs(unauthenticated));

        it('still prefers the header the caller sent', () => {
            expect(author.resolve('akadmin')).toBe('akadmin');
        });

        it('falls back to the caller\'s own subject when the header is absent', () => {
            expect(author.resolve(undefined)).toBe('developer');
        });

        it('refuses a header that is present but not a username, rather than falling back', () => {
            expect(() => author.resolve('a b')).toThrow(BadRequest);
            expect(() => author.resolve('')).toThrow(BadRequest);
        });
    });

    it('answers 401 with no caller', () => {
        expect(() => author.resolve(undefined)).toThrow(new Unauthorized('Authentication required.'));
    });
});
