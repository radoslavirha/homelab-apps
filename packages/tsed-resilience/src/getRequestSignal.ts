import type { PlatformContext } from '@tsed/platform-http';

/** Context key under which the per-request `AbortController` is memoised. */
const CONTROLLER_KEY = '$requestAbortController';

/** The slice of Node's `IncomingMessage` this module relies on. */
interface RawRequest {
    once?: (event: string, listener: () => void) => void;
}

/** The slice of Node's `ServerResponse` this module relies on. */
interface RawResponse {
    once?: (event: string, listener: () => void) => void;
    writableEnded?: boolean;
}

/**
 * Returns the {@link AbortSignal} tied to this request's lifecycle. The signal
 * aborts when the client disconnects, so abandoned requests stop doing outbound
 * HTTP / database work.
 *
 * The controller is memoised on the {@link PlatformContext}, so every call
 * within a request returns the same signal, and it is garbage-collected with
 * the context.
 *
 * Prefer the {@link RequestSignal} parameter decorator in controllers; reach for
 * this function directly only in middlewares or filters that already hold a
 * `PlatformContext`.
 *
 * @example
 * ```ts
 * @Middleware()
 * class MyMiddleware {
 *   use(@Context() ctx: PlatformContext) {
 *     const signal = getRequestSignal(ctx);
 *   }
 * }
 * ```
 */
export function getRequestSignal(ctx: PlatformContext): AbortSignal {
    const existing = ctx.get<AbortController | undefined>(CONTROLLER_KEY);
    if (existing) {
        return existing.signal;
    }

    const controller = new AbortController();
    ctx.set(CONTROLLER_KEY, controller);

    const onDisconnect = (): void => {
        if (!controller.signal.aborted) {
            controller.abort();
        }
    };

    // `aborted` covers a client that leaves before the request body is complete.
    // The request's own `close` is NOT a disconnect signal: Node emits it as soon
    // as the body has been consumed (autoDestroy), while the handler still runs.
    const raw = ctx.request?.raw as RawRequest | undefined;
    if (typeof raw?.once === 'function') {
        raw.once('aborted', onDisconnect);
    }

    // The response's `close` fires either after a normal `end()` (ignored through
    // `writableEnded`) or when the connection drops before the response was sent.
    const res = ctx.response?.raw as RawResponse | undefined;
    if (typeof res?.once === 'function') {
        res.once('close', () => {
            if (!res.writableEnded) {
                onDisconnect();
            }
        });
    }

    return controller.signal;
}
