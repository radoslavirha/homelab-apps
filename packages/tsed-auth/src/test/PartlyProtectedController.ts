import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';
import { TEST_METHOD } from '@radoslavirha/auth';
import { Authenticate } from '../decorators.js';

/** Method-level use: supported, though the class-level form is the safe default. */
@Controller('/mixed')
export class PartlyProtectedController {
    @Get('/open')
    open(): string {
        return 'open';
    }

    @Get('/closed')
    @Authenticate(TEST_METHOD)
    closed(): string {
        return 'closed';
    }
}

