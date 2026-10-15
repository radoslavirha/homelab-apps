import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';
import { TEST_METHOD } from '@radoslavirha/auth';
import { Authenticate, RequireRoles } from '../decorators.js';

@Controller('/roled')
@Authenticate(TEST_METHOD)
@RequireRoles('qr-manager.reader')
export class RoledController {
    @Get('/')
    read(): string {
        return 'read';
    }

    @Get('/admin-only')
    @RequireRoles('qr-manager.admin')
    adminOnly(): string {
        return 'admin';
    }

    @Get('/either')
    @RequireRoles('qr-manager.admin', 'qr-manager.editor')
    either(): string {
        return 'either';
    }
}

