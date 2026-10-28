# @radoslavirha/ui-auth

## 0.2.4

### Patch Changes

- [#306](https://github.com/radoslavirha/homelab-apps/pull/306) [`8610efa`](https://github.com/radoslavirha/homelab-apps/commit/8610efadeef292ba1896c876eda0e489a2d36d5c) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A failed sign-in callback no longer leaves a dead `code`/`state` in the address bar, so reloading lands on the sign-in page instead of failing again.

- [#307](https://github.com/radoslavirha/homelab-apps/pull/307) [`12cc17b`](https://github.com/radoslavirha/homelab-apps/commit/12cc17bf4dc1a7e751d930fb48bf997e891852d2) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A signed-out deep link, or a renewal after the IdP session ended, now keeps its return path instead of landing on the default route.

## 0.2.3

### Patch Changes

- Updated dependencies [[`ea42b4a`](https://github.com/radoslavirha/homelab-apps/commit/ea42b4a40b23387f03dbd7907d7e9c7167b84814)]:
  - @radoslavirha/ui-runtime@0.3.3

## 0.2.2

### Patch Changes

- [`099d0cd`](https://github.com/radoslavirha/homelab-apps/commit/099d0cd52cbb08f3bc850569b2fd5e6ab9b31f4b) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update packages
- Updated dependencies [[`099d0cd`](https://github.com/radoslavirha/homelab-apps/commit/099d0cd52cbb08f3bc850569b2fd5e6ab9b31f4b)]:
  - @radoslavirha/ui-runtime@0.3.2

## 0.2.1

### Patch Changes

- [`824756b`](https://github.com/radoslavirha/homelab-apps/commit/824756b4d472000c8654370be46e29dba41be49c) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies
- Updated dependencies [[`b00ffb9`](https://github.com/radoslavirha/homelab-apps/commit/b00ffb98c552cc7aa773556005049b2769fa5f18), [`824756b`](https://github.com/radoslavirha/homelab-apps/commit/824756b4d472000c8654370be46e29dba41be49c)]:
  - @radoslavirha/ui-runtime@0.3.1

## 0.2.0

### Minor Changes

- [#100](https://github.com/radoslavirha/iot-miniservers/pull/100) [`8eff9a3`](https://github.com/radoslavirha/iot-miniservers/commit/8eff9a3fc7c6aea685ad23d70158346f9c1903d6) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Keep a browser session alive, and stop reporting a dead one as healthy.
  
  Three defects that only showed up in a browser, all of which passed the test suite:
  
  - **Nothing renewed the token.** `automaticSilentRenew` is off — correctly, it uses a hidden iframe and
    Authentik sets `X-Frame-Options: DENY` — but nothing replaced it, so a tab open past the 30-minute
    lifetime held a dead token. Renewal is now a top-level `prompt=none` redirect scheduled a minute
    before expiry, and it returns the user to the page they were on rather than the landing route.
  - **`getAccessToken()` did not check expiry**, so the request seam attached that dead token.
  - **A `401` classified as a healthy backend.** `classifyResponse` mapped every 4xx to `client-error`,
    which is right for a validation error and wrong for an expired session: the user saw a green banner
    and a raw failure string with nothing prompting a re-login. 401 and 403 are now an `unauthorized`
    outcome and surface as `unauthenticated`, with banner copy that says to sign in again rather than
    claiming a retry is coming.
  
  `<AuthCallback>` moves into `@radoslavirha/ui-auth`. It takes `navigate` as a **prop** rather than
  calling `useNavigate()` internally, because a single-screen app should not have to adopt a router to
  get a login. It owns the single-exchange guard, the `returnTo` handling and the basename stripping —
  all three are things every frontend would otherwise reimplement, and the exchange guard is invisible
  without a browser because the first exchange succeeds and the user still lands signed in.
  
  `@radoslavirha/ui-kit` gains the `unauthenticated` banner state, deliberately worded apart from
  `degraded`: nothing is broken and nothing is retrying, so "having problems — retrying" would be a lie
  that makes the user wait for a recovery that cannot come.

### Patch Changes

- Updated dependencies [[`8eff9a3`](https://github.com/radoslavirha/iot-miniservers/commit/8eff9a3fc7c6aea685ad23d70158346f9c1903d6)]:
  - @radoslavirha/ui-runtime@0.3.0
