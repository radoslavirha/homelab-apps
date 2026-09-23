import { SwaggerController } from '@radoslavirha/tsed-swagger';
import { getServerDefaultConfig } from '@radoslavirha/tsed-configuration';
import { HealthController } from '@radoslavirha/tsed-health';
import { BaseServer } from '@radoslavirha/tsed-platform';
import { Configuration } from '@tsed/di';
import './providers/index.js';
// Imported for its side effect: the @Injectable({ type: HEALTH_CHECKS }) decorator runs
// on module load, which is what makes the check visible to injectMany.
import './health/index.js';
import * as rest from './controllers/index.js';
import { ObjectUtils } from '@radoslavirha/utils';

@Configuration({
    ...getServerDefaultConfig(),
    mount: {
        // HealthController stays at '/' so the probe path is identical across every app —
        // the chart's probe block is copy-paste only while that holds.
        '/': [SwaggerController, HealthController, ...ObjectUtils.values(rest)]
    }
})
export class Server extends BaseServer {
    $beforeRoutesInit(): void {
        this.registerMiddlewares();
    }
}
