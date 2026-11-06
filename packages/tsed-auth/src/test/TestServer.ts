import { Configuration } from '@tsed/di';
import '@tsed/platform-express';
import { OpenAccessController } from './OpenAccessController.js';
import './TestAuthProvider.js';

/**
 * Minimal Ts.ED server for the guard's integration spec.
 *
 * Does not extend `BaseServer` from `@radoslavirha/tsed-platform`, which sits
 * above this package. The `@tsed/platform-express` import supplies the platform
 * adapter — without it `PlatformTest.callback()` never responds.
 */
@Configuration({
    mount: {
        '/': [OpenAccessController]
    },
    logger: {
        level: 'off'
    }
})
export class TestServer {}
