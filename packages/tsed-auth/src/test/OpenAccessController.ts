import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';
import type { Principal } from '@radoslavirha/auth';
import { Authenticate, CurrentPrincipal, RequireRoles } from '../decorators.js';

/** The method name the integration server configures as `unauthenticated`. */
export const OPEN_METHOD = 'OPEN';

/**
 * Guarded exactly like a route behind an IdP — `@Authenticate` and
 * `@RequireRoles` unchanged. Only the configuration decides that `OPEN` admits
 * every request.
 */
@Controller('/open')
@Authenticate(OPEN_METHOD)
@RequireRoles('kb.reader')
export class OpenAccessController {
    @Get('/')
    public whoAmI(@CurrentPrincipal() principal: Principal | undefined): string {
        return principal?.subject ?? 'nobody';
    }

    @Get('/admin')
    @RequireRoles('kb.admin')
    public admin(): string {
        return 'admin';
    }
}
