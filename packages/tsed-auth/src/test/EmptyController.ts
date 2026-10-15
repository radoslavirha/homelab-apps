import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';
import { TEST_METHOD } from '@radoslavirha/auth';
import { Authenticate, RequireRoles } from '../decorators.js';

// `@RequireRoles()` is a mistake, but it must not document a refusal the
// guard will never produce — it treats an empty entry as no requirement.
@Controller('/empty')
@Authenticate(TEST_METHOD)
export class EmptyController {
    @Get('/')
    @RequireRoles()
    list(): string {
        return '';
    }
}

