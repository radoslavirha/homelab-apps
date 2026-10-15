import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';
import { TEST_METHOD } from '@radoslavirha/auth';
import type { Principal } from '@radoslavirha/auth';
import { Anonymous, Authenticate, CurrentPrincipal } from '../decorators.js';

@Controller('/things')
@Authenticate(TEST_METHOD)
export class ProtectedController {
    @Get('/')
    list(@CurrentPrincipal() principal: Principal | undefined): string {
        return principal?.subject ?? 'anonymous';
    }

    @Get('/public')
    @Anonymous()
    open(): string {
        return 'open';
    }
}

