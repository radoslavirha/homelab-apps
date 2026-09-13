# Documentation

## Development

This document describes the process for running these APIs on your local computer.

### Prerequisites

- node.js > 24
- pnpm > 11.26

### Getting started

Create `.env` and add your PAT for GiHub packages. You'll need to use it before installing like: `NODE_AUTH_TOKEN=XXX pnpm install`

## Docker

### Local build

Create `.npmrc.docker` in root. This is just `.npmrc` with replaced env variable with auth token for private npm packages.

Every app is a stage in the single root `Dockerfile`, so builds run from the repo root and
pick the app with `--target`:

```sh
docker build -t {image}:{tag} --secret id=npmrc,src=.npmrc.docker --target {app} .
docker run {image}:{tag}
```

`{app}` is the stage name — the app's directory name (`qr-manager-api`, `qr-manager-ui`, …),
plus `{app}-config-validator` for the UIs.

### Image rules

All apps are stages in the one root `Dockerfile`, so these hold for every image:

- API stages build `FROM runtime-base` (Node runtime only), never `FROM base` (which has pnpm).
- `runtime-base` is `gcr.io/distroless/nodejs24-debian12:nonroot` — no shell, no package manager, 10 OS packages instead of 79.
- `runtime-base` owns `USER 65532`, `WORKDIR /home/app` and `NODE_ENV=production` — app stages do not repeat them, and copy with `--chown=65532:65532`. The three charts in the `homelab` repo must pin the same UID.
- `CMD` keeps the OpenTelemetry preload (`--import /home/app/dist/otel/instrument.js`). Without it traces and log `trace_id`s vanish silently. On distroless the ENTRYPOINT is already the node binary, so `CMD` holds node's argv and the leading `node` word is **not** repeated.
- Debugging has no shell: `kubectl exec <pod> -- /nodejs/bin/node -e '…'` (absolute path — `node` is not on `PATH`). `fs.readdirSync` / `fs.readFileSync` / `fetch` stand in for `ls` / `cat` / `curl`.
- Build-only packages stay in `devDependencies`, since `pnpm deploy --prod` copies `dependencies` into the image. `@swc/helpers` is the deliberate exception — `.swcrc` sets `externalHelpers: true`.
- `dist/` carries no source maps and no compiled tests (`sourceMaps: false`, `--ignore '**/*.spec.ts'`).
- The npm auth token is only ever a build secret (`--mount=type=secret,id=npmrc`), never `ARG` or `ENV`.

Nothing checks this in CI on purpose: one Dockerfile and few hands on it do not justify a build step that can fail for its own reasons on every PR. The cluster is the backstop — pods run non-root with a read-only root filesystem, so an image that regains root fails to start rather than running privileged.

Reference point, from the 2026-09 slimming: `qr-manager-api` went 462MB → 349MB once the package manager, the TypeScript compiler and 72 source-map/spec files stopped being shipped, then → 253MB on distroless. An image far off that size is worth a look. (The 332MB figure this line used to quote was measured before subsequent dependency growth; 349MB is the same Dockerfile re-measured on 2026-09-13.)
