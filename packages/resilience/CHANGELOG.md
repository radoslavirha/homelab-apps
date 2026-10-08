# @radoslavirha/resilience

## 0.2.3

### Patch Changes

- [#246](https://github.com/radoslavirha/homelab-apps/pull/246) [`663d4c8`](https://github.com/radoslavirha/homelab-apps/commit/663d4c8d756157cf23296c89ac1820ce0cb10971) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A half-open circuit breaker trial that times out now keeps the breaker open instead of closing it, even when `shouldHandle` ignores timeouts.

- [#261](https://github.com/radoslavirha/homelab-apps/pull/261) [`b5893aa`](https://github.com/radoslavirha/homelab-apps/commit/b5893aa9e781fbd6d8dc89cb2bcaa12687462c47) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A call that started before the circuit breaker opened no longer reopens a half-open breaker when its client cancels or it times out.

## 0.2.2

### Patch Changes

- [`824756b`](https://github.com/radoslavirha/homelab-apps/commit/824756b4d472000c8654370be46e29dba41be49c) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies

## 0.2.1

### Patch Changes

- [`8046bc5`](https://github.com/radoslavirha/iot-miniservers/commit/8046bc5e20911838609caef053f1a5d209c3cd82) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies

## 0.2.0

### Minor Changes

- [#54](https://github.com/radoslavirha/iot-miniservers/pull/54) [`ccb17cc`](https://github.com/radoslavirha/iot-miniservers/commit/ccb17cc3238db60ecd521ce7606bd2687c580603) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Add transport-agnostic resilience (timeout, retry, circuit breaker) with AbortSignal support.

  - `@radoslavirha/resilience`: new package. cockatiel-backed `createResiliencePolicy` /
    `ResiliencePolicyFactory` wrapping any `(signal) => Promise<T>`, composed as
    retry → circuit breaker → timeout, plus `combineSignals` and re-exported error guards
    (`isBrokenCircuitError`, `isTaskCancelledError`).
  - `@radoslavirha/tsed-resilience`: new package. A `@RequestSignal()` parameter decorator that
    injects an `AbortSignal` tied to the HTTP request lifecycle, usable from `SINGLETON`
    controllers, plus `getRequestSignal(ctx)` for middlewares.
  - `@radoslavirha/http-provider`: **config shape changed** — `axios-retry` and the `retry` entry
    are replaced by an optional `resilience` section (timeout + retry + circuit breaker). Retry is
    now **opt-in** (`retry.count` defaults to `0`, previously `3`), and the retriable statuses
    moved from `retry.statusCodes` to a top-level `retriableStatusCodes` (default
    `[500, 502, 503, 504]`). The factory parses each entry through `HttpProviderEntrySchema`, so
    Zod supplies every default.
  - `qr-manager-api`: wires the redirect path (`RedirectController` → `QrCodeService` →
    `QrCodeMongoRepository.findBySlug`) through a resilience policy + `maxTimeMS`, cancelled by
    the request-lifecycle signal.
