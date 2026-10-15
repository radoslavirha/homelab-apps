import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';
import { TEST_METHOD } from '@radoslavirha/auth';
import { Authenticate } from '../decorators.js';

@Controller('/devices')
@Authenticate(TEST_METHOD)
export class ExplicitController {
    @Get('/')
    list(): string {
        return '';
    }
}

