import { Controller } from '@tsed/di';
import { Get, Post } from '@tsed/schema';
import { TEST_METHOD } from '@radoslavirha/auth';
import type { Principal } from '@radoslavirha/auth';
import { Anonymous, Authenticate, CurrentPrincipal } from '../decorators.js';

@Controller('/qr-codes')
@Authenticate(TEST_METHOD)
export class DocumentedController {
    @Get('/')
    list(@CurrentPrincipal() principal: Principal | undefined): string {
        return principal?.subject ?? '';
    }

    @Post('/')
    create(): string {
        return 'created';
    }

    @Get('/:slug')
    @Anonymous()
    resolve(): string {
        return 'redirect';
    }
}

