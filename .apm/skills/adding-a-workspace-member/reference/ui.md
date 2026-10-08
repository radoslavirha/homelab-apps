# Wiring a new UI

The template's files, and what to adapt in each:

| File | What to adapt |
| --- | --- |
| `package.json` | `name`, `description`, `version: 0.1.0`. React tooling from the named catalog `catalog:react` (react, react-dom, react-router-dom, vite, @vitejs/plugin-react, jsdom, @testing-library/*, @types/react*); shared tooling from `catalog:`. Keep the `build` and `build:validator` scripts. |
| `tsconfig.json` | `module: ESNext`, `jsx: react-jsx`. |
| `vite.config.ts` | `base: './'`, `build.copyPublicDir: false`, a dev `server.port` unique across UIs (5173, 5174 are taken), and an `/api` proxy to the API's local port if it calls one. |
| `vitest.config.ts` | jsdom environment, `setupFiles: ['./src/test-setup.ts']`, coverage thresholds 70%. |
| `eslint.config.mjs` | Re-exports `@radoslavirha/config-eslint`. |
| `index.html` | Plain Vite entry: `<div id="root">` + `<script type="module" src="/src/main.tsx">`. |
| `public/config.json` | Dev config only. Never copied into `dist/`. |
| `src/runtime/RuntimeConfig.ts` | The app's Zod schema + `loadConfig()` via `loadRuntimeConfig` from `@radoslavirha/ui-runtime`. Use `httpUrl()`, not `z.url()`. |
| `src/runtime/validate-config.ts` | `runConfigValidatorCli(<Schema>, process.argv[2], '<name>')` — bundled into the validator image. |
| `src/main.tsx` | Awaits `loadConfig()`, then mounts `<App />`; renders a hint for each `RuntimeConfigError` reason. |
| `src/App.tsx`, `src/test-setup.ts`, `src/vite-env.d.ts`, `src/styles.css` | Root component; `import '@testing-library/jest-dom/vitest';`; Vite types; styles. |
| `nginx.conf`, `nginx.conf.template` | SPA fallback to `index.html`, `/config.json` with `Cache-Control: no-store`, `<base href>` from `${NGINX_BASE_PATH}`. |
| `docker-entrypoint.d/` | Keep `10-normalize-base-path.envsh` if the app is served under a sub-path. |
| `deploy.json` | `gitops/helm-values/server1/apps/<name>/values-<env>.yaml` with `yamlPath: .image.tag`, for `sandbox` and `production`. `onboarding-to-homelab` creates those files. |

`config.json` is served to the browser, so it must never hold a credential — a server-side value
is an nginx env var instead (see `ui/homelab-dashboard-ui/AGENTS.md`).

## Outside the directory

1. **Root `Dockerfile`** — four stages, per `reference/dockerfile.md`.
2. **`.github/paths-filter-apps.yaml`** — one line; the key is the full path:

   ```yaml
   ui/<name>: ui/<name>/**
   ```

3. **No change** to `pnpm-workspace.yaml`.
4. **Auth** (template `qr-manager-ui` only): the app needs Authentik applications per stage, including a `<app>-local` one for development, in the `homelab` repo's `authentik-blueprints.yaml`. That is a separate homelab change — tell the user. Verify the flow with the `verifying-auth-in-browser` skill.
