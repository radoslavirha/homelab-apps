# Wiring a new shared package

| File | What to adapt |
| --- | --- |
| `package.json` | `name: @radoslavirha/<name>`, `description`, `version: 0.1.0`; `main`/`exports` pointing to `dist/`. Consumers inside the repo use `workspace:*`. |
| `tsconfig.json` | Extends `@radoslavirha/config-typescript/tsconfig.json` (the `using-config-typescript` skill names the bases). |
| `eslint.config.mjs` | Re-exports `@radoslavirha/config-eslint`. |
| `tsdown.config.ts` | Build config (`using-config-tsdown` skill). |
| `vitest.config.ts` | Thin wrapper over `@radoslavirha/config-vitest` (`using-config-vitest` skill). |
| `src/index.ts` | Public exports. |
| `README.md` | What it does and how a consumer uses it. Optional for agents, expected for people. |

## Outside the directory

**`.github/paths-filter-packages.yaml`** — **not** `paths-filter-apps.yaml`, which is for
deployable apps only. Packages are keyed by the bare directory name:

```yaml
<name>: packages/<name>/**
```

Miss this and CI goes **silently green**: `pull_request.yaml` builds `build-package-code` from a
matrix over this file's changed keys, so a PR touching only the new package yields
`packages: []` and no build job runs at all. `scripts/check-member.sh` fails on a missing entry.

`nginx-runtime` is the one deliberate omission: its `build`, `lint` and `test` scripts are all
`true`, so a matrix entry would only add no-op jobs.

No Dockerfile stage and no `deploy.json` — packages are not deployed on their own. If the
Dockerfile's `deps` stage must build it before an app, it already does: `pnpm --filter './packages/**' run build`.
