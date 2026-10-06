# Wiring a new API

Every file below must exist or the API will not start. The template already has them; adapt
each one rather than writing it from scratch.

| File | What to adapt |
| --- | --- |
| `package.json` | `name`, `description`, `version: 0.1.0`. Keep `@radoslavirha/*` and `@tsed/*` on the catalog like the other APIs. Build-only packages (`typescript`, `@swc/cli`, `@swc-node/register`) stay in `devDependencies`; `@swc/helpers` stays in `dependencies`. |
| `tsconfig.json` | Extends `@radoslavirha/config-typescript/tsconfig.json`; `composite: false`. |
| `eslint.config.mjs`, `nodemon.json`, `.swcrc`, `vitest.config.ts` | Usually identical across APIs. `.swcrc` keeps `sourceMaps: false` and `externalHelpers: true`. |
| `config/localhost.json` | `server.httpPort` unique across APIs (the checker enforces it). |
| `config/test.json` | Test config, including the inline HS256 auth key. |
| `src/models/config/ConfigModel.ts` | Extends `BaseConfig`; app fields here. Include `auth: createAuthConfigSchema(Object.values(AuthMethod))` and `health: HealthConfigSchema.optional()`. |
| `src/models/config/AuthMethod.enum.ts` | The trust domains this API accepts (`IDP`, …) — see root AGENTS.md § Authentication. |
| `src/services/ConfigService.ts` | Standard `ConfigProvider<ConfigModel>` — identical across APIs. |
| `src/providers/AuthProvider.ts`, `HealthProvider.ts`, `LoggerProvider.ts` | Hand each toolkit service its config by overriding its token. |
| `src/Server.ts` | Mounts `SwaggerController` and `HealthController` at `/`, plus `controllers/index.ts`. Imports `src/health/index.ts` for its side effect. |
| `src/health/index.ts` | Health checks. Mongo: re-export `MongoHealthCheck` from `@radoslavirha/tsed-health/mongoose`. |
| `src/index.ts` | Bootstrap — identical across APIs, including `createShutdownHandler(platform)`. |
| `src/otel/instrument.ts` | OTel SDK preload (loaded via `node --import` in `start:prod` and the image `CMD`). |
| `deploy.json` | `gitops/helm-values/server1/apps/<name>/values-<env>.yaml` with `yamlPath: .image.tag`, for `sandbox` and `production`. `onboarding-to-homelab` creates those files. |

## Outside the directory

1. **Root `Dockerfile`** — two stages, per `reference/dockerfile.md`.
2. **`.github/paths-filter-apps.yaml`** — one line; the key is the full path:

   ```yaml
   apis/<name>: apis/<name>/**
   ```

3. **No change** to `pnpm-workspace.yaml` — the `apis/*` glob picks it up.

## Tests to start with

- `Server.integration.spec.ts` asserting the expected health check **names** (a 200 from `/health` does not prove a check is registered).
- An integration suite for each controller covering the auth failure paths: forged signature, wrong audience, expired token, non-bearer scheme.
