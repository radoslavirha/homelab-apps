# AGENTS.md — AI Agent Instructions

All agentic tools (skills, instructions, agents, …) authored **in this repository** live in `.apm/`:

```
repository/
+-- apm.yml            // APM manifest - edit only via the `apm` CLI
+-- apm.lock.yaml      // resolved commits - generated, committed
+-- .apm/              // repo-authored sources - tracked in git
|   +-- skills/<name>/SKILL.md (+ reference/, scripts/, evals/)
|   +-- instructions/<name>.instructions.md   // path-scoped via `applyTo`
```

`apm install` deploys those sources, plus every installed toolkit-hub plugin, into
`.agents/`, `.claude/` and `.github/instructions/`. **Those three directories are generated
and gitignored — never edit a file in them.** APM refuses to manage a file it did not write,
so the edit is lost on the next `apm install`/`apm update` and never reaches anyone else.
Change the source under `.apm/` (or the upstream toolkit-hub plugin) and redeploy instead.
Run `apm install` after cloning to materialise them.

Each `CLAUDE.md` in this repo is one line, `@AGENTS.md`, so Claude Code loads the `AGENTS.md`
beside it. A new app gets both files (`adding-a-workspace-member` skill).

## Repository Overview

This is a **pnpm monorepo** of small independent Node.js APIs built with **Ts.ED**, React UIs, and
the shared packages they use.

## Tech Stack

- **Runtime**: Node.js 24+
- **Package manager**: pnpm 11 (`engines.pnpm` is `>= 11.26`; CI pins 11)
- **Language**: TypeScript with `@radoslavirha/config-typescript` (ESM, `.js` extensions in imports)
- **Framework**: Ts.ED with `@radoslavirha/tsed-*`; React 19 + Vite for UIs
- **Testing**: Vitest with `@radoslavirha/config-vitest`
- **Linting**: ESLint with `@radoslavirha/config-eslint`
- **Versioning**: Changesets

## Prerequisites

CLI tools the workflows here assume. Check before starting work that needs them:

| Tool | Needed for | Check |
| --- | --- | --- |
| `pnpm` 11 + Node 24 | everything | `pnpm -v && node -v` |
| `NODE_AUTH_TOKEN` | `pnpm install` (GitHub Packages) — it is in `.env` | `grep -q '^NODE_AUTH_TOKEN=.' .env` |
| Docker, running | Mongo-backed tests (testcontainers) | `docker info >/dev/null` |
| `apm` | deploying skills and rules after clone / after editing `.apm/` | `apm --version` |
| `gh`, authenticated | anything touching GitHub (issues, PRs, the `homelab` repo) | `gh auth status` |

npm dependencies come from `pnpm install`; skills do not list them. A skill names any extra CLI
tool it needs in its own *Prerequisites*.

## Package Registry

All `@radoslavirha/*` packages are hosted on **GitHub Packages** (`npm.pkg.github.com`), not the public npm registry. The root `.npmrc` configures this scope.

- `NODE_AUTH_TOKEN` must be set in the environment before running `pnpm install`, it's in `.env`

Always use [toolkit-hub](https://github.com/radoslavirha/toolkit-hub) where possible and avoid creating own logic if already exist in toolkit-hub. All `@radoslavirha/*` libraries are provided there.

### Catalog updates are automated

`renovate.json` keeps the `@radoslavirha/*` entries in the `pnpm-workspace.yaml` catalog
moving on their own — **do not hand-bump them**. Renovate opens one grouped `toolkit-hub` PR,
and patch/minor merge themselves once the `Verify workspace` CI job is green. Majors wait for
a review. Every other dependency in this repo is still a deliberate manual bump.

Two things there are load-bearing and easy to break:

- The rule carries an explicit `registryUrls`. Renovate attaches a package file's `.npmrc` to
  `package.json` files only, so without it the catalog entries get looked up on
  `registry.npmjs.org` and every one of them 404s — silently, as "no updates found".
- `rangeStrategy` is `bump`, so a release inside the existing range (`^0.5.7` -> `0.5.8`) still
  moves the catalog entry. The default `replace` would touch only `pnpm-lock.yaml`.

Local `packages/*` are also named `@radoslavirha/*`, but they are consumed as `workspace:*`
and Renovate skips them.

## Skills

**Toolkit-hub skills.** Every `@radoslavirha/*` toolkit package this repo depends on ships its own
skill (`using-*`, `building-a-tsed-service`, `adopting-toolkit-hub`), installed from the
`toolkit-hub` APM marketplace. **Invoke the matching skill before writing code against a
package** — they document the current API, including renames the old shapes leave traps behind
for. Their descriptions in the skill list say when each applies.

**Repo-local skills** (sources in `.apm/skills/`):

| Task | Skill |
| --- | --- |
| Adding an API, UI or shared package; editing the root `Dockerfile` | `adding-a-workspace-member` |
| Deploying a new app to the homelab cluster | `onboarding-to-homelab` |
| Regenerating an app `README.md` or `docs/KNOWLEDGE.md` | `updating-docs` |
| Adding a timer, poller, listener, startup task or outbound device call | `instrumenting-entry-points` |
| Any change to auth in a UI, `packages/ui-auth` or an Authentik blueprint | `verifying-auth-in-browser` |

Managing them:

```bash
apm install                                    # deploy everything in apm.yml
apm marketplace browse toolkit-hub             # see the full plugin catalog
apm install <name>@toolkit-hub --target claude,copilot
apm update                                     # move unpinned deps forward
```

Dependencies are intentionally unpinned, so `apm install` warns about drift — `apm.lock.yaml`
pins the resolved commit, and guidance should not lag the code it describes.

## Monorepo Structure

```text
apis/<api-name>/
  src/
    controllers/          # Ts.ED HTTP controllers — one file per resource. SINGLETON scoped when possible.
    endpoints/            # External API/data source wrappers (not HTTP controllers).
      <API group>/
        dto/              # DTO models for endpoints.
        *Endpoint.ts      # Endpoint service that accepts/returns only DTOs. SINGLETON scoped when possible.
    handlers/             # Per-endpoint business logic. Orchestrate services/mappers. SINGLETON scoped when possible.
    mappers/              # Bi-directional mapper services (DTO ↔ model). Never use services or endpoints. SINGLETON scoped when possible.
    models/               # Ts.ED schema models, enums, request/response types. Use sub-folders to group (`config/`, etc.).
    services/             # Reusable, stateless business logic. Includes ConfigService, storage facades, etc. SINGLETON scoped when possible.
    storage/
      <storage group>/    # Per backend + entity (e.g. `qr-mongo/`, `device-local-storage/`).
        dto/              # DTO models for storage repositories.
        *Repository.ts    # Repository service that accepts/returns only DTOs. SINGLETON scoped when possible.
    otel/                 # OpenTelemetry bootstrap (`instrument.ts`), per-API OTel config, and `telemetry.ts` — the span names, tracer scopes, `job.name` values and app attribute keys this API emits.
    providers/            # Overrides that hand a toolkit service its config (`LoggerProvider`, `HealthProvider`, `AuthProvider`). Each subclasses the package's service and re-declares its token; the override is mandatory, since a plain config object has no DI token to resolve.
    ModelGroups.ts        # Groups used in `@Groups()` decorator. Groups belong on Controller endpoints (request/response models) and Models. If `@Groups()` is used in a child model, the parent model must use `@ForwardGroups()` on that property.
    Server.ts
    index.ts
```

There is no `v1/` folder and no API version prefix in routes — all controllers mount at `/`. Versioning is handled at the package level via Changesets, not inside route paths.

```text
ui/<ui-name>/
  src/
    api/                  # Typed REST clients consumed by pages/components.
    components/           # Presentational React components.
    pages/                # Route components — orchestrate api/ clients and components/.
    runtime/
      RuntimeConfig.ts    # Zod schema for config.json + loadConfig() via @radoslavirha/ui-runtime.
      validate-config.ts  # Same schema bundled (esbuild) into the <ui>-config-validator image.
    App.tsx               # Root component with router definitions.
    main.tsx              # Awaits loadConfig(), then mounts <App />.
    styles.css
  public/
    config.json           # Dev config only — never copied to dist/ (copyPublicDir: false).
  docker-entrypoint.d/    # nginx entrypoint hooks (base-path normalisation, required env).
  nginx.conf              # nginx main config.
  nginx.conf.template     # Server block, rendered by envsubst at start (NGINX_BASE_PATH).
  deploy.json             # Helm values file + yamlPath of the image tag per env (release.yaml needs it).
```

## Coding Conventions

### General

- Always use **ESM** imports with explicit `.js` extensions (e.g. `import { Foo } from './Foo.js'`)
- Avoid constructing DTOs and calling endpoints/repositories from handlers. Delegate DTO construction to services.
- Use `@radoslavirha/*` packages from [toolkit-hub](https://github.com/radoslavirha/toolkit-hub)
- always use class member visibility modifiers

### Dependency Injection (Ts.ED)

- **Controllers**: `@Controller`, `@Scope(ProviderScope.SINGLETON)`
- **Handlers**: `@Injectable`, `@Scope(ProviderScope.SINGLETON)`
- **Services**: `@Service`, `@Scope(ProviderScope.SINGLETON)`
- Inject dependencies via constructor parameters.

### Models

- Decorate all properties with `@tsed/schema` decorators: `@Property(String)`, `@Required`, `@Description`, `@Example`
- Use `@AdditionalProperties(false)` on all model classes
- Export all models from `models/index.ts`
- DTO models do not need `@Description` decorator, use JSDoc.
- Endpoint request/response models follow CamelCase `{Resource}{HTTP Method}{Request/Response}` convention
- always build models using `CommonUtils.buildModelStrict` / `CommonUtils.buildModelPartial` / `CommonUtils.buildModelCore` from `@radoslavirha/utils` (`buildModelStrict` for fully-defined models, `buildModelPartial` for partial/patch-like data, `buildModelCore` only for shared low-level model-building helpers)

### Enums

- Enum **values are always `UPPER_SNAKE_CASE`**. Members and the type stay `PascalCase`:

  ```ts
  export enum ExternalApi {
      ChmiPortal = 'CHMI_PORTAL',
      ChmiOpendata = 'CHMI_OPENDATA'
  }
  ```

- One enum per file, named `<Name>.enum.ts`.
- **Exception — DTO enums.** Enums under `endpoints/*/dto/` and `storage/*/dto/` mirror an
  external wire format, so their values must match that format exactly, whatever its casing
  (e.g. `MiotSpecV2PropertyAccessDTO.Read = 'read'`, because miot-spec.org sends `read`).
  The internal model enum it maps to still uses `UPPER_SNAKE_CASE`
  (`MiotSpecV2PropertyAccess.Read = 'READ'`).
- A few older enums still carry lowercase values (e.g. `DataSources.Radar = 'radar'`,
  `SwaggerDocs.API = 'api'`); they predate this rule and are migrated opportunistically, not in
  bulk, since values are part of the external contract (routes, config keys, stored data).

### Mappers

- Always do bi-directional mapping between DTO <-> Model.
- Extend `MappingUtils` from `@radoslavirha/utils`
- Export all from `mappers/index.ts`

### Services & Handlers

- Services contain reusable, stateless logic
- Handlers orchestrate services for a specific use case and map to controller actions
- Export all from `services/index.ts` and `handlers/index.ts`
- avoid constructing models, delegate to mappers

### Controllers

- One controller file per resource
- Use `@Docs(version)` for Swagger grouping
- Use `@Returns(...)` with proper content types
- Export from `controllers/index.ts`

## Testing

- Framework: **Vitest**. Unit specs `*.spec.ts` co-located with source; integration specs `*.integration.spec.ts` with `PlatformTest` from `@tsed/platform-http/testing`.
- Run: `pnpm --filter ./<member-path> test` (or `pnpm test` inside the member).
- Conventions are path-scoped rules in `.apm/instructions/` (`testing`, `tsed-testing`, `react-testing`); they load when you open a spec. A bug fix's test must fail without the fix — prove it with `bash scripts/check-regression-test.sh`.

## Adding a workspace member

New `apis/*`, `ui/*` and `packages/*` members are auto-discovered by `pnpm-workspace.yaml`, but
each needs Dockerfile stages, a CI paths filter entry, `deploy.json` and docs. Use the
`adding-a-workspace-member` skill; it also carries the Dockerfile rules (distroless runtime,
UID 65532, the `--import` preload, build-only deps) and why each one matters.

## Authentication

Inbound auth is `@radoslavirha/auth` (decides) plus `@radoslavirha/tsed-auth` (guards the request).
Full guidance: [`packages/tsed-auth/README.md`](./packages/tsed-auth/README.md). The rules that
matter in every change:

- **`@Authenticate` goes on the controller class, not on each method**, so a route added later is
  protected the moment it is written. `@Anonymous()` is the per-route opt-out, and **every use of
  it needs a reason in a comment next to it.**
- **Declare `AuthMethod` in the app** and feed it to the config schema:
  `auth: createAuthConfigSchema(Object.values(AuthMethod))`. It names *trust domains* (where a
  caller's credential comes from), not caller classes or mechanisms.
- **There is no way to switch auth off** — no mode, no `enabled` flag, no permissive verifier.
  Local development uses the sandbox IdP's real JWKS (`config/localhost.json`); tests use an
  inline HS256 key (`config/test.json`).
- **A misconfiguration must fail at boot** (`createAuthConfigSchema` makes it a parse error).

## Health checks

Every API exposes `/health/live`, `/health/ready` and `/health` via `HealthController` from
`@radoslavirha/tsed-health`. Full guidance: [its README](./packages/tsed-health/README.md) —
start at *Quick Reference for AI Agents*. The rules that bite:

- **Do not write your own MongoDB check** — re-export `MongoHealthCheck` from
  `@radoslavirha/tsed-health/mongoose` in the app's `src/health/index.ts`.
- **Tag every app-local check `@Injectable({ type: HEALTH_CHECKS })`** and import the
  `src/health/index.ts` barrel from `Server.ts`. A bare `@Injectable()` check is silently skipped;
  assert the expected check names in an integration test.
- **Mount `HealthController` at `/`**, and **never mount a single-segment catch-all at the root**
  (`@Get('/:slug')` on `@Controller('/')` swallows `/health`). `qr-manager-api` puts its redirect
  under `/r` for this reason.
- **`critical: true` only for dependencies without which this pod can do nothing** (its own
  database or broker); third-party APIs are always `false`. A dependency disabled by config
  reports `pass`.
- **Never put a URL, hostname, credential or stack trace in `detail`** — `/health` is readable by
  anything that can reach the pod.
- **Drain on SIGTERM** with `createShutdownHandler(platform)` in `index.ts`, not on `beforeExit`.

## Instrumenting entry points

HTTP and MQTT already root their own traces. **Anything else that starts work must root one
itself** — a timer, poller, listener, queue consumer or `$onInit` task — or every call underneath
becomes a parentless trace and every log line loses `trace_id`. Scheduled work uses `runJob`
(span *and* `job.*` metrics); miot device calls use `withMiotCallSpan`. Identifier span attributes
are strings, quantities are numbers. Details, metric design and test assertions: the
`instrumenting-entry-points` skill.

**`packages/otel` takes no new dependencies** — see
[its README](./packages/otel/README.md#dependency-policy--do-not-add-dependencies-to-this-package).
Pass extra instrumentations in from the app via `init`'s `extraInstrumentations`.

## Server configuration

- uses [config](https://www.npmjs.com/package/config) library
  - `config/` directory structure comes from this library, files may differ except `custom-environment-variables.json`
  - `NODE_ENV` value when running server from `package.json` should match filename. `NODE_ENV=localhost {command to start server}` will require `config/localhost.json` file.
  - `config/test.json` exists for tests as testing frameworks usually set `NODE_ENV=test`
  - `config/custom-environment-variables.json` is not mandatory, it's only for advanced usage when [config](https://www.npmjs.com/package/config) can use/replace environment variable in json file during runtime.
- uses `@radoslavirha/tsed-configuration` for loading server configuration.

### Configuration backward compatibility (repository-wide rule)

- Treat configuration as a versioned contract across all apps and packages.
- All config changes must be backward compatible for rolling deployments.
- Assume a new ConfigMap can be applied before all old pods are replaced.
- During rollout, old and new versions may run concurrently.
- Prefer additive config changes; remove legacy keys only after all workloads run a compatible version.
- Do not enforce runtime strict rejection of unknown future keys when it can block older running versions.

## Versioning & Changesets

- Uses `@changesets/cli` for versioning; follows [Semantic Versioning](http://semver.org/).
- Create a changeset with `pnpm changeset`. It is interactive — in a non-interactive session write
  `.changeset/<slug>.md` by hand (frontmatter `"<package name>": patch|minor|major`, then one line).

## Deploy

A release (`.github/workflows/release.yaml`) builds every app that carries a changeset into
`ghcr.io/radoslavirha/<name>` and bumps its image tag in the `homelab` repo at the path its
`deploy.json` names. A new app is deployed with the `onboarding-to-homelab` skill. The
`externalApis` ConfigMap shapes are in [docs/Deployment.md](./docs/Deployment.md).
