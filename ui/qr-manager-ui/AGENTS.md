# Instructions

- End-user documentation lives in [README.md](./README.md). Architecture / dev notes live in [DEVELOPMENT.md](./DEVELOPMENT.md).
- The reference UI: a new UI copies its layout, runtime config, nginx and Dockerfile wiring from here (`adding-a-workspace-member` skill).

## Source layout beyond the root conventions

- `src/api/` — `createQrCodesClient(apiBaseURL)` (typed CRUD client), `useQrCodesClient` hook, shared types.
- `src/pages/` — the admin pages plus `SignInPage` and `CallbackPage` for the OIDC flow (`@radoslavirha/ui-auth`).
- `src/runtime/RuntimeConfig.ts` — the Zod schema for `config.json`; `validate-config.ts` bundles the same schema into the `qr-manager-ui-config-validator` image (`pnpm run build:validator`). `RuntimeConfigContext` and `ApiStatusContext` expose config and backend reachability to components.

## Runtime config pattern

`main.tsx` calls `loadConfig()` (`loadRuntimeConfig` from `@radoslavirha/ui-runtime`), which fetches and validates `config.json`, and mounts React only once it resolves. A `RuntimeConfigError` renders a hint per failure reason instead of a blank page. In Kubernetes the chart runs the validator image as an initContainer first, so a malformed ConfigMap never reaches nginx.

`public/` holds only the development `config.json`; `vite.config.ts` sets `copyPublicDir: false` so it never reaches `dist/`. In Kubernetes `config.json` is mounted from a ConfigMap at `/usr/share/nginx/html/config.json` and served with `Cache-Control: no-store`.

## Routing and base path

- `/` redirects to `/admin`; `/admin` is the list, `/admin/new` the create form, `/admin/:id` the detail/edit page; `/callback` finishes the OIDC login.
- Vite builds with `base: './'`. nginx injects `<base href>` from the `NGINX_BASE_PATH` env var at container start (`docker-entrypoint.d/10-normalize-base-path.envsh` + `nginx.conf.template`), and `config.basePath` feeds `<BrowserRouter basename>` — one image serves `/` or a sub-path without a rebuild.
- Local dev proxies `/api` to `qr-manager-api` on `localhost:4002` (the API sends no CORS headers; Traefik owns CORS in the cluster).

## Conventions

- React 19 + Vite. API calls go through `createQrCodesClient(apiBaseURL)` — never hard-code a base URL in components.
- Page components are not unit-tested directly; `App.spec.tsx` exercises them through the full router with a fetch mock.
- Any change to auth wiring must be verified with the `verifying-auth-in-browser` skill.
