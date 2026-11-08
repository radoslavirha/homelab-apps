import { BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { getContext, Injectable, ProviderScope } from '@tsed/di';
import type { PlatformContext } from '@tsed/platform-http';
import { ConfigService } from '../services/ConfigService.js';

/** The child the toolkit's `Logger` writes its request log through. */
const REQUEST_LOG_SCOPE = 'HTTP_REQUEST';

/**
 * The server's logger: keeps request and response bodies out of the request log, and the expected
 * `401` out of its errors.
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

    /**
     * Every MCP client calls once without a token to discover the login, so a `401` with a
     * `WWW-Authenticate` challenge is the protocol working, not a failure: it is logged at `info`,
     * with the same fields, as `MCP_AUTH_REFUSED` is. Every other failure stays at `error`.
     *
     * The toolkit's `Logger` always logs `>= 400` at `error` and offers no option, and only `child`
     * can be overridden. Its constructor calls it, so this runs before the subclass is initialised
     * and must not use instance state. `LoggerProvider.integration.spec.ts` fails if a toolkit
     * bump stops routing the request log through here.
     */
    public override child<K extends object>(scope: string, options?: { readonly metaProvider?: () => Partial<K> }): BaseLogger<K> {
        const child = super.child<K>(scope, options);

        if (scope === REQUEST_LOG_SCOPE) {
            const error = child.error.bind(child);

            child.error = (body, meta): void => {
                if (LoggerProvider.isAuthChallenge()) {
                    child.info(body, meta);
                } else {
                    error(body, meta);
                }
            };
        }

        return child;
    }

    private static isAuthChallenge(): boolean {
        const response = getContext<PlatformContext>()?.response;

        return response?.statusCode === 401 && CommonUtils.notNil(response.getHeaders()['www-authenticate']);
    }
}
