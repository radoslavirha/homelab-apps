import { getServerDefaultConfig } from '@radoslavirha/tsed-configuration';
import { HealthController } from '@radoslavirha/tsed-health';
import { BaseServer } from '@radoslavirha/tsed-platform';
import { Configuration } from '@tsed/di';
// Registers the MCP module; its endpoint is configured in index.ts (`mcp`), from ConfigService.
import '@tsed/platform-mcp';
import './health/index.js';
import './providers/index.js';

@Configuration({
    ...getServerDefaultConfig(),
    mount: {
        // HealthController stays at '/' so the probe path is identical across every app —
        // the chart's probe block is copy-paste only while that holds.
        '/': [HealthController]
    }
})
export class Server extends BaseServer {}
