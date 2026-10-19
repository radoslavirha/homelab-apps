import { PrincipalService } from '@radoslavirha/tsed-auth';
import { Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope } from '@tsed/di';
import { ConfigService } from '../services/ConfigService.js';
import type { LoggerProviderLogMetadata } from './LoggerProviderLogMetadata.js';

/**
 * The API's logger: names the caller on every line, and keeps request and response bodies out of
 * the request log.
 *
 * Bodies are off in code, not in configuration, so no values file can turn them back on. A
 * response here is knowledge-base content — one `GET /search` line carried every snippet (~30 KB),
 * `GET /documents` carries whole documents — and logging it copies the corpus into Loki. No route
 * takes a request body. Method, url, status, duration, the query string and the redacted headers
 * stay.
 */
@Injectable({ token: Logger, scope: ProviderScope.SINGLETON })
export class LoggerProvider extends Logger {
    constructor(configService: ConfigService, principals: PrincipalService) {
        const options = configService.config.logger;

        super(
            {
                ...options,
                requests: {
                    ...options?.requests,
                    request: { enabled: false },
                    response: { enabled: false }
                }
            },
            (): LoggerProviderLogMetadata => {
                const principal = principals.current();

                return CommonUtils.isUndefined(principal)
                    ? {}
                    : { principalSubject: principal.subject, principalKind: principal.kind, principalIssuer: principal.issuer };
            }
        );
    }
}
