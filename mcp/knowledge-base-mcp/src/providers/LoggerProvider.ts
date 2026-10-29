import { Logger } from '@radoslavirha/tsed-logger';
import { Injectable, ProviderScope } from '@tsed/di';
import { ConfigService } from '../services/ConfigService.js';

/**
 * The server's logger: keeps request and response bodies out of the request log.
 *
 * Bodies are off in code, not in configuration, so no values file can turn them back on. Every
 * tool call is a `POST` whose body is the JSON-RPC payload, so a logged body carries the tool's
 * arguments — whole documents, and any secret knowledge-base-api then refuses to store. Method,
 * url, status, duration, the query string and the redacted headers stay.
 */
@Injectable({ token: Logger, scope: ProviderScope.SINGLETON })
export class LoggerProvider extends Logger {
    constructor(configService: ConfigService) {
        const options = configService.config.logger;

        super({
            ...options,
            requests: {
                ...options?.requests,
                request: { enabled: false },
                response: { enabled: false }
            }
        });
    }
}
