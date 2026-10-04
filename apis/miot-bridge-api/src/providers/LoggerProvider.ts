import { Logger, LoggerOptionsSchema } from '@radoslavirha/tsed-logger';
import { Injectable, ProviderScope } from '@tsed/di';
import { ConfigService } from '../services/ConfigService.js';

/**
 * Selectors for the device secrets that travel in request/response bodies
 * (`token` authenticates a device on the LAN, `stamp` is its handshake counter).
 * The HTTP response is serialised *after* the request logger records it, so the
 * `!simplified-spec` group does not keep them out of the log — they must be
 * redacted here. Covers a bare device, a list and a device nested one level deep.
 */
const DEVICE_SECRET_SELECTORS = ['token', 'stamp', '*.token', '*.stamp', '*.*.token', '*.*.stamp'];

@Injectable({ token: Logger, scope: ProviderScope.SINGLETON })
export class LoggerProvider extends Logger {

    constructor(configService: ConfigService) {
        const options = LoggerOptionsSchema.parse(configService.config.logger ?? {});
        const merge = (paths: string[]): string[] => [...new Set([...paths, ...DEVICE_SECRET_SELECTORS])];

        super({
            ...options,
            requests: {
                ...options.requests,
                request: {
                    ...options.requests.request,
                    redactPaths: merge(options.requests.request.redactPaths)
                },
                response: {
                    ...options.requests.response,
                    redactPaths: merge(options.requests.response.redactPaths)
                }
            }
        });
    }
}
