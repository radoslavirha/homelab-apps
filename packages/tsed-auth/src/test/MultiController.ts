import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';
import { TEST_METHOD } from '@radoslavirha/auth';
import { Authenticate } from '../decorators.js';

// Order is policy: the chain tries them in this sequence, so it must
// survive the round trip through the store.
@Controller('/multi')
@Authenticate(TEST_METHOD, 'API_KEY')
export class MultiController {
    @Get('/') list(): string {
        return '';
    }
}

