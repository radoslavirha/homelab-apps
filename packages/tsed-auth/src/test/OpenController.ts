import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';
import { TEST_METHOD } from '@radoslavirha/auth';
import { Anonymous, Authenticate, RequireRoles } from '../decorators.js';

@Controller('/open')
@Authenticate(TEST_METHOD)
@RequireRoles('qr-manager.reader')
export class OpenController {
    @Get('/free')
    @Anonymous()
    free(): string {
        return 'free';
    }
}

