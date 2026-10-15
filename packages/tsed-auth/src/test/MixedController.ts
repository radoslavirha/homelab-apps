import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';
import { TEST_METHOD } from '@radoslavirha/auth';
import { Authenticate } from '../decorators.js';

// The behaviour `interactive-map-feeder-api` depends on to keep a
// person's token out of the device route. It works only because the
// encoded value is a string: Ts.ED concatenates arrays on merge, so a
// plain `string[]` here would have made this route admit both.
@Controller('/mixed')
@Authenticate(TEST_METHOD)
export class MixedController {
    @Get('/inherited') inherited(): string {
        return '';
    }

    @Get('/swapped')
    @Authenticate('DEVICE')
    swapped(): string {
        return '';
    }
}

