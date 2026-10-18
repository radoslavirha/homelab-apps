---
name: verifying-auth-in-browser
description: Verify an OIDC login flow by actually running it in a browser against the real IdP, instead of reasoning about it. Use when changing anything in packages/ui-auth, a UI's auth wiring, an Authentik blueprint, or when a login, logout, silent-renew or redirect behaviour is claimed to work. Also use before writing "verified" about any auth change, and whenever an end-to-end test, UI or API, has to sign in as the test user `claude`.
---

# Verify auth in a browser

Auth in this repo has been wrong five times, and **every single time it was a thing that could have
been checked in under a minute and was assumed instead**:

| Assumed | Reality | The check that would have caught it |
| --- | --- | --- |
| Hidden-iframe silent renew works | `X-Frame-Options: DENY` on every Authentik response | `curl -sI https://auth.irha.cz \| grep -i x-frame` |
| The IdP gate keeps people out of the app | It gates tokens, not pages; the app was fully usable signed out | Open the app without signing in |
| Skipping the probe on the callback fixes the loop | It did, and replaced it with a permanent `Loading…` | Sign in and watch |
| One `Log out` ends the session | It ran the *provider* flow, which preserves the session | `prompt=none` after logout |
| A session that stops working shows as broken | It reported healthy: `401` classified as an ordinary client error | Force a `401` and read the banner |

The tests passed for all five. **Unit tests cannot see redirects, framing, cookies, or the IdP.**

## The rule

Do not write "verified", "works", or "fixed" about an auth change until you have run it. If you
cannot run it, say which specific thing is unverified and why — never let it read as proven.

## Who signs in

The Authentik test user **`claude`**, for every check below. Its password and TOTP secret come from
OpenBao through the operator's `claude-e2e` helper (`~/.local/bin/claude-e2e`), which hands them to
**one** child process as `E2E_USERNAME`, `E2E_PASSWORD` and `E2E_TOTP_SECRET`:

```bash
claude-e2e run -- <cmd>
```

The design lives in the homelab repo, `docs/identity.md` § The E2E test user.

- **Never ask the operator for credentials**, and never type them into the built-in browser pane. The
  login happens inside `<cmd>`: `scripts/ui_login.cjs` or `scripts/authentik_token.py`, below.
- **Never print them.** No `env` or `printenv` under `claude-e2e run`.
- **Log in once per run, then reuse** the saved browser session or the token. Authentik accepts each
  30-second TOTP time step once, so a second login inside the same window fails. Both scripts wait for
  a fresh window, which means a login takes up to 30 s.
- **On a failure, stop.** Never loop a login: every failed attempt counts toward the reputation
  lockout, five of them lock `claude` out for 24 hours. A failed OpenBao login means it is sealed or
  unreachable; tell the operator.
- **Sandbox by default.** `claude` holds production groups for the few tests that need them. Touch
  production only when the task names it, and only read unless the task says to change something.
- Its Authentik groups decide the `roles` in every token. A test that needs a role `claude` lacks is a
  request to the operator, not something to work around.

Throwaway users are no longer cheap: MFA is mandatory, so a new user's first login is forced into
enrolment. Use `claude`.

## How to run it

### 1. Local dev against the real IdP — the default

Each app has a **`<app>-local` application of its own** in Authentik — its own `client_id`, issuer and
role groups — whose registered redirect URIs are `http://localhost:5173/callback` and
`http://localhost:5173/`. Declared as `{ stage: local }` in
`homelab` → `gitops/helm-values/server3/authentik-blueprints.yaml`. So local development does the real
flow against the real IdP.

**Sandbox applications carry no loopback URI.** If a login from `pnpm dev` fails with
`Invalid redirect URI`, the app's config is pointing at the sandbox `client_id` — point it at
`<app>-local`. And a local token is **not** a sandbox token: its `iss` and
`aud` are the local application's, so an API accepts it only through a trusted-issuer row in that
developer's own `config/localhost.json`, which never ships.

```bash
pnpm --filter=<ui> dev          # http://localhost:5173
```

`public/config.json` already carries the localhost redirect URIs. It is not a bypass: localhost is a
secure context, PKCE is real, the token is the same token.

**Never point a UI's local config at a production client**, and never add a loopback redirect URI to a
production application — anything running on a developer's machine could then complete a production
login. The `local` applications exist so that nobody has a reason to: the chart `fail`s on
`{ cluster: …, stage: local }`, and every other stage renders its deployed host and nothing else.

### 2. Driving it with Playwright

This repo has no Playwright dependency. Install it once outside the repo:

```bash
npm install --prefix "$TMPDIR/pw" playwright
"$TMPDIR/pw/node_modules/.bin/playwright" install chromium
```

**Sign in once with the script, then start every page from the saved session.** Paths under
`scripts/` are relative to this skill's directory:

```bash
NODE_PATH="$TMPDIR/pw/node_modules" claude-e2e run -- \
  node scripts/ui_login.cjs <ui-base-url> "$TMPDIR/claude-state.json"
```

```js
const ctx = await browser.newContext({ storageState: `${process.env.TMPDIR}/claude-state.json` });
```

- The script is `.cjs` because the repo root is `"type": "module"`, and `NODE_PATH` only feeds
  `require()`.
- The state file holds a live Authentik session. Keep it under `$TMPDIR`, never in the repo.
- Reusing it costs exactly one top-level `prompt=none` hop to the IdP and no form. That was measured
  on 2026-10-18 against sandbox qr-manager, and it is also check 3 below.
- The script prints its IdP and sub-frame navigation counts: checks 2 and 6 in miniature.

Authentik's flow UI is web components, so:

- **Everything must be `:visible`.** The stages carry hidden `username`, `password` and `code` inputs
  for autofill. `input[type="password"]` matches a hidden one and silently does nothing. Use
  `input[name="uidField"]:visible`, `input[name="password"]:visible`, `input[name="code"]:visible`.
- **`innerText` on `body` returns "Powered by authentik"** — the form is in shadow DOM. Do not use
  page text to decide whether a stage rendered; query for the input.
- **`<ak-loading-overlay>` sits between stages and swallows pointer events**, so a click retries
  until it times out. Wait for it to detach, then submit with `Enter` rather than clicking:

  ```js
  const settle = async () => {
      await page.locator('ak-loading-overlay').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(500);
  };
  ```

Count **main-frame navigation requests** — that is how a redirect loop shows up, and nothing else
reveals it:

```js
const hops = [];
page.on('request', r => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) hops.push(r.url());
});
```

**Use `request`, not `framenavigated`.** `framenavigated` fires only for *committed documents*, and
the healthy `prompt=none` path never commits one: with a live SSO session the IdP answers the
authorize request with a `302` straight back to `/callback`, so Chromium commits nothing at
`auth.irha.cz`. Measured on 2026-09-07, a reload of a signed-in app reported **0 IdP hops by
`framenavigated` and 1 by `request`** — and 1 is the correct answer. A loop built out of `302`s, which
is the common shape, is exactly what `framenavigated` cannot see.

Count hops **to the IdP**, not to the callback: `/callback` legitimately appears twice (document load,
then the router's `replace`). One request to `auth.irha.cz` is healthy. Four callbacks with repeated
IdP hops is a loop that happened to terminate — the user sees it as "never ending".

Count **sub-frame** navigations too, and assert there are none. That is the check that catches an
iframe creeping back in, and it is one line:

```js
const frames = [];
page.on('framenavigated', f => f !== page.mainFrame() && frames.push(f.url()));
```

### 3. Against a deployed environment

Point Playwright at the deployed URL. Note the version actually running before drawing conclusions —
`git show origin/main:ui/<ui>/package.json | grep version` against the image tag in `homelab`. Testing
a fix that is not deployed yet proves nothing.

**Open the trailing-slash URL.** `https://<host>/qr-manager` answers `301` to
`http://<host>:8080/qr-manager/`: the container's own scheme and port, a page that never loads.
Measured on 2026-10-18 in sandbox and production. A script that waits for the IdP there times out
before any login, which looks like a broken sign-in page. Use `…/qr-manager/`.

**Do not** try to serve a local build from the deployed hostname. It was attempted: it needs a
self-signed cert, `--host-resolver-rules`, and disabling Chromium's Local Network Access checks, and
it still fails because Playwright follows cross-origin redirects internally without re-invoking
`route` handlers — so the redirect back from the IdP is silently served by the *real* deployed app and
you test the wrong build. Use local dev (1) instead. That is what the registered localhost URI is for.

## What to check, every time

1. **Anonymous visitor** — sign-in page, none of the app, and it *settles*. No loop, no permanent
   `Loading…`.
2. **Sign in** — lands on the app, header shows `preferred_username`, **one** callback navigation.
3. **Reload** — still signed in, no typing.
4. **`localStorage`** — `oidc.<state>` during login is fine; **a `user` entry holding tokens is a bug**.
   `await page.evaluate(() => Object.keys(localStorage))`.
5. **Log out** — returns to the app AND ends the IdP session. Prove the second half:
   `prompt=none` afterwards must return `error=login_required`, not a code.
6. **Session renewal** — the access token lives 30 minutes, so do not wait for it. Install
   Playwright's clock before navigating and advance past the renewal point:

   ```js
   await page.clock.install({ time: new Date() });
   // … sign in …
   await page.clock.fastForward('29:10');   // renewal fires a minute before expiry
   ```

   Three things must hold: the renewal is a **top-level** `prompt=none` request with **no sub-frame
   navigation at all**, the app is still signed in afterwards, and it lands back on **the page it left**
   rather than the app's home route. Check the last one from a detail URL, not the landing page —
   that is the only place the difference shows.

   Then check the failure path, by answering the authorize request with `login_required` instead of
   letting it succeed: the app must land on the sign-in page and send **no further requests carrying
   the dead token**.

7. **Console** — a clean run has no errors. `X-Frame-Options` and CORS failures appear only here.
   A `400` on every login means the authorization code is being exchanged twice: codes are
   single-use, and StrictMode double-invokes effects, so the callback needs a `useRef` guard. It is
   invisible without a browser, because the first exchange succeeds and the user still lands signed in.

## Checking the IdP directly

Faster than a browser for anything about the IdP itself, and it catches a whole class of assumption:

```bash
curl -sI https://auth.irha.cz/ | grep -i x-frame                    # framing
curl -s  https://auth.irha.cz/application/o/<client>/.well-known/openid-configuration \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['scopes_supported'], d['grant_types_supported'])"
curl -sI -H 'Origin: https://<app-host>' https://auth.irha.cz/application/o/token/ | grep -i access-control
```

### Headless login recipe

`scripts/authentik_token.py` implements this recipe. It reads the UI's `config.json`, so the token is
exactly the one that UI would get: same `iss`, `aud` and `roles`. stdout carries the token and nothing
else; capture it, never echo it.

```bash
TOKEN=$(claude-e2e run -- python3 -I scripts/authentik_token.py https://apps.sandbox.server1.homelab.irha.cz/qr-manager/)
curl -H "Authorization: Bearer $TOKEN" https://api.sandbox.server1.homelab.irha.cz/iot/qr-manager/qr-codes
```

The token lives 30 minutes and comes with no refresh token. Fetch one per run.

Logging in without a browser goes through Authentik's flow executor API in four steps. It is
genuinely useful for token and claim checks. It **cannot** see framing, cookie policy, or anything
React does, which is exactly how the iframe mistake survived. Two details cost time once:

1. `GET /application/o/authorize/?…` returns `302` to `/if/flow/<slug>/?<query>`.
2. Call the executor as
   `GET /api/v3/flows/executor/<slug>/?query=<the flow page's query string, urlencoded whole>`.
   **Passing that query string raw instead of wrapped in a single `query=` parameter silently drops
   `next`** — login then succeeds and dumps you on `/if/user/` with no code, which looks exactly like
   a refusal.
3. Walk the stages, `POST`ing JSON to the same executor URL with a cookie jar:
   `ak-stage-identification` ← `{"uid_field": "<username>"}`, then
   `ak-stage-password` ← `{"password": "…"}`, then
   `ak-stage-authenticator-validate` ← `{"code": "<6 digits>"}`. A code alone is enough, with no
   device selection, while the user has a single TOTP device (measured 2026-10-18). **A `302` back to
   the executor means "stage advanced, re-`GET` me"**. It is not a failure and not the final
   redirect. No CSRF header is needed.
4. The terminal stage is `xak-flow-redirect`. After the authentication flow its `to` is the authorize
   URL again. Re-`GET` that with the same cookie jar: under implicit consent it answers `302` straight
   to the callback carrying `code=`. A refusal instead ends on a `200` HTML page titled
   `Permission denied - authentik`.

Then `POST /application/o/token/` form-encoded with `grant_type=authorization_code`, `code`,
`redirect_uri`, `client_id` and `code_verifier` — and no secret.

## Recording what you find

A surprise goes into the Authentik integration contract's *What is NOT verified* section, in the
private knowledge base (skill `knowledge-base`), with the command that proves it.
That is how the next person avoids assuming the same thing.
