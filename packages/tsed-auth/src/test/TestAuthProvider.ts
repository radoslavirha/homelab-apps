import { AuthConfigSchema, VerifierType } from '@radoslavirha/auth';
import { Injectable, ProviderScope } from '@tsed/di';
import { AuthenticationService } from '../AuthenticationService.js';
import { OPEN_METHOD } from './OpenAccessController.js';

/**
 * Test-only `AuthenticationService` override, the same idiom every API's
 * `AuthProvider` uses: the base class takes a plain config object, which has no
 * DI token, so an override must supply it.
 *
 * `OPEN` is an `unauthenticated` entry granting `kb.reader` and `kb.editor` —
 * deliberately not `kb.admin`, so a route requiring it still answers `403`.
 */
@Injectable({ token: AuthenticationService, scope: ProviderScope.SINGLETON })
export class TestAuthProvider extends AuthenticationService {
    public constructor() {
        super(AuthConfigSchema.parse({
            [OPEN_METHOD]: {
                type: VerifierType.Unauthenticated,
                roles: ['kb.reader', 'kb.editor'],
                defaultSubject: 'developer',
                subjectHeader: 'X-User'
            }
        }));
    }
}
