---
name: add-workspace-member
description: Checklist for adding a new UI, API, or shared package to the monorepo. Use when user says "add new api", "add new ui", "add new package", "new workspace member", or starts scaffolding a new app.
---

# Add Workspace Member

Ensures no required files or infra wiring are missed when adding a new member to the pnpm monorepo.

## Trigger

`/add-workspace-member [type] [name]`

- `type`: `api` | `ui` | `package`
- `name`: kebab-case directory name (e.g. `sensor-bridge-api`, `homelab-dashboard-ui`)

---

## Adding a New UI (`ui/<name>/`)

### Step 1 — Scaffold source files

Required files (copy from nearest existing UI as template, e.g. `ui/qr-manager-ui/`):

| File | Notes |
|------|-------|
| `package.json` | `name: "<name>"`, React + Vite; use named catalogs: `catalog:react` for react, react-dom, react-router-dom, vite, @vitejs/plugin-react, jsdom, @testing-library/*, @types/react, @types/react-dom; use `catalog:` for shared tooling (typescript, eslint, @vitest/coverage-v8, @types/node, etc.) |
| `tsconfig.json` | `module: ESNext`, `jsx: react-jsx` |
| `vite.config.ts` | `base` from `process.env.VITE_BASE_PATH`; port unique across UIs |
| `vitest.config.ts` | jsdom environment, coverage thresholds (statements/branches/functions/lines ≥ 70) |
| `eslint.config.mjs` | Re-exports `@radoslavirha/config-eslint` |
| `index.html` | Inline script fetches `/config.json` BEFORE bundle, exposes `window.__APP_CONFIG_PROMISE__` |
| `public/config.json` | Dev defaults |
| `public/config.example.json` | Documented example config (no real secrets) |
| `nginx.conf` | Static fallback — SPA to `index.html`, no-cache `/config.json` |
| `nginx.conf.template` | Template processed by nginx envsubst entrypoint; use `${ENV_VAR}` syntax |
| `src/vite-env.d.ts` | `/// <reference types="vite/client" />` |
| `src/test-setup.ts` | `import '@testing-library/jest-dom/vitest';` |
| `src/runtime/RuntimeConfig.ts` | `loadRuntimeConfig(): Promise<AppConfig>` — fetch + validate config.json |
| `src/types.ts` | Core TypeScript interfaces including `AppConfig` |
| `src/App.tsx` | Root component |
| `src/main.tsx` | Awaits `loadRuntimeConfig()` then renders `<App />` |
| `deploy.json` | Helm values files + `yamlPath` of the image tag, per env — copy from `ui/qr-manager-ui/`. `release.yaml` fails a release of an app without one |
| `README.md` | See format below |

### Step 2 — Update root Dockerfile

Copy the four `qr-manager-ui` stages (`build-<name>`, `<name>`, `build-<name>-validator`,
`<name>-config-validator`) and change the name. Keep what they encode: the
`nginx-unprivileged` base on port 8080, numeric `USER 101`, the `nginx-runtime` healthz snippet
and config-validation entrypoint, and no `config.json` baked into `dist/`. The comments in those
stages carry the reasons.

### Step 3 — Update `.github/paths-filter-apps.yaml`

Add one line:

```yaml
ui/<name>: ui/<name>/**
```

### Step 4 — Install dependencies

```bash
NODE_AUTH_TOKEN=$(cat .env | grep NODE_AUTH_TOKEN | cut -d= -f2) pnpm install
```

Or ensure `NODE_AUTH_TOKEN` is in the environment, then run `pnpm install` from repo root.

### Step 5 — Verify

```bash
cd ui/<name>
pnpm lint
pnpm build
pnpm test
```

### README.md format for UI

```markdown
# <name>

<2-3 sentence description of purpose.>

## External Dependencies

| System | Protocol | Purpose |
|--------|----------|---------|
| ...    | ...      | ...     |

## Runtime Config

Loaded from `/config.json` before React bundle runs. In production: k8s ConfigMap.

| Key | Required | Description |
|-----|----------|-------------|
| `key` | ✓/— | ... |
```

---

## Adding a New API (`apis/<name>/`)

### Step 1 — Scaffold source files

The required file list — including health checks, `AuthMethod` and `AuthProvider` — is in
`AGENTS.md` § "Adding a New API". Copy from the nearest existing API (e.g. `apis/qr-manager-api/`)
and pick an unused `server.httpPort`. Add a `deploy.json` (copy from `apis/qr-manager-api/`) — `release.yaml`
fails a release of an app without one. `README.md`: see format below.

### Step 2 — Update root Dockerfile

Copy the two `qr-manager-api` stages and change the name. The final stage is
`FROM runtime-base` — the rules and their reasons are in `AGENTS.md` § "Adding a New API", step 5.

### Step 3 — Update `.github/paths-filter-apps.yaml`

```yaml
apis/<name>: apis/<name>/**
```

### Step 4 — Install & verify

```bash
pnpm install   # from repo root, NODE_AUTH_TOKEN required
cd apis/<name>
pnpm lint
pnpm build
pnpm test
```

### README.md format for API

Use the `update-docs` skill — it generates the correct format automatically.

---

## Adding a New Shared Package (`packages/<name>/`)

### Step 1 — Scaffold source files

| File | Notes |
|------|-------|
| `package.json` | `name`, `description`; `main`/`exports` pointing to `dist/` |
| `tsconfig.json` | Extends `@radoslavirha/config-typescript/tsconfig.json` |
| `eslint.config.mjs` | Re-exports `@radoslavirha/config-eslint` |
| `tsdown.config.ts` | Build config (ESM output) |
| `vitest.config.ts` | Unit test config |
| `src/index.ts` | Public exports |

### Step 2 — Update `.github/paths-filter-packages.yaml`

**Not** `paths-filter-apps.yaml` — that one is for deployable apps only (`apis/*`, `ui/*`), and its
keys are full paths. Packages have their own filter file, keyed by the bare directory name:

```yaml
<name>: packages/<name>/**
```

Miss this and CI goes **silently green**: `pull_request.yaml` builds `build-package-code` from a
matrix over this file's changed keys, so a PR touching only the new package yields `packages: []`
and no build job runs at all. Nothing fails — nothing is checked.

Verify every package directory has an entry — review anything this prints:

```bash
diff <(ls packages/ | sort) <(grep -oE '^[a-z0-9-]+:' .github/paths-filter-packages.yaml | tr -d ':' | sort)
```

`nginx-runtime` is a known, deliberate omission: its `build`, `lint` and `test` scripts are all
`true`, so a matrix entry would only add three no-op jobs. Its real check is `test:docker`, which
CI does not run. Any *other* difference is a package that CI is not checking.

### Step 3 — Install & verify

```bash
pnpm install   # from repo root, NODE_AUTH_TOKEN required
cd packages/<name>
pnpm lint
pnpm build
pnpm test
```

---

## Checklist (quick reference)

| Step | UI | API | Package |
|------|----|-----|---------|
| Scaffold source files | ✓ | ✓ | ✓ |
| Add `deploy.json` | ✓ | ✓ | — |
| Write `README.md` | ✓ | ✓ (via `update-docs`) | optional |
| Add Dockerfile stages | ✓ | ✓ | — |
| Add `.github/paths-filter-apps.yaml` entry (full path key) | ✓ | ✓ | — |
| Add `.github/paths-filter-packages.yaml` entry (bare name key) | — | — | ✓ |
| `pnpm install` from root | ✓ | ✓ | ✓ |
| `pnpm lint && pnpm build && pnpm test` | ✓ | ✓ | ✓ |
| Run `onboard-to-homelab` skill for k8s deploy | ✓ | ✓ | — |
| Run `update-docs` skill | — | ✓ | — |
