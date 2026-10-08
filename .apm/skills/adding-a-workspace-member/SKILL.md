---
name: adding-a-workspace-member
description: Adds a new API, UI or shared package to the pnpm monorepo by copying the closest existing member, then wiring it into the root Dockerfile, the CI paths filters, deploy.json and the agent docs, and verifying the result with a checker script. Also holds the root Dockerfile rules. Use when the user says "add new api", "add new ui", "add new package", "new workspace member", starts scaffolding under apis/, ui/ or packages/, or edits the root Dockerfile.
---

# Adding a workspace member

New members are auto-discovered by the `apis/*`, `ui/*` and `packages/*` globs in
`pnpm-workspace.yaml`. Everything **outside** the member's directory is not, and a miss there
fails silently: no CI job, no image, no release. `scripts/check-member.sh` checks all of it.

## Prerequisites

- `NODE_AUTH_TOKEN` exported (it is in `.env`) — `pnpm install` reads GitHub Packages.
- Docker running — Mongo-backed API tests start a testcontainer.

## Inputs

- **type**: `api` | `ui` | `package`
- **name**: kebab-case directory name. APIs end in `-api`, UIs in `-ui` (`sensor-bridge-api`, `homelab-dashboard-ui`).

Ask for anything missing. Do not guess a name.

## Workflow

Copy this checklist into your response and tick it off as you go:

```
Member: <type>/<name>   Template: <template path>
- [ ] 1. Pick the template member
- [ ] 2. Copy it and strip its domain code
- [ ] 3. Wire it in (type-specific reference file)
- [ ] 4. Agent docs: AGENTS.md + CLAUDE.md (apps only)
- [ ] 5. Install, then lint/build/test until green
- [ ] 6. check-member.sh passes
- [ ] 7. README via updating-docs (apps); onboarding-to-homelab (apps); changeset when it should ship
```

### 1. Pick the template member

| Type | Template | When |
| --- | --- | --- |
| api | `apis/qr-manager-api` | has its own MongoDB |
| api | `apis/interactive-map-feeder-api` | no database, calls external HTTP APIs |
| ui | `ui/qr-manager-ui` | signs users in (`@radoslavirha/ui-auth`) |
| ui | `ui/homelab-dashboard-ui` | no sign-in |
| package | the existing package closest in kind (`tsed-*` for Ts.ED glue, `ui-*` for React) | — |

### 2. Copy and strip

```bash
rsync -a --exclude node_modules --exclude dist --exclude dist-validator --exclude coverage \
  --exclude CHANGELOG.md <template>/ <type-dir>/<name>/
```

Then in the copy:

- `package.json`: `name` (`<name>` for apps, `@radoslavirha/<name>` for packages), a real `description` (it becomes the image description), `version` `0.1.0`.
- Delete the template's domain code (controllers, handlers, models, pages, …) and keep the scaffolding: bootstrap, config, providers, health, otel, runtime config, test setup.
- Replace every remaining occurrence of the template's name. Step 6 lists any you missed.

### 3. Wire it in

Read the reference file for the type and do every step in it:

- **API** → [reference/api.md](reference/api.md)
- **UI** → [reference/ui.md](reference/ui.md)
- **Package** → [reference/package.md](reference/package.md)

Apps also add Dockerfile stages: follow [reference/dockerfile.md](reference/dockerfile.md). Read it before any edit to the root `Dockerfile`, too.

### 4. Agent docs (apps only)

- `<member>/AGENTS.md` — what the app does and only what differs from the root conventions (see `apis/interactive-map-feeder-api/AGENTS.md`). No file-by-file tree: it goes stale.
- `<member>/CLAUDE.md` — exactly one line, `@AGENTS.md`, so Claude Code loads it.

### 5. Install and verify

```bash
pnpm install                                   # repo root
pnpm --filter ./<type-dir>/<name> lint
pnpm --filter ./<type-dir>/<name> build
pnpm --filter ./<type-dir>/<name> test
```

If one fails, fix it and rerun **that command and every one after it**. Do not move on while one is red.

### 6. Check the wiring

```bash
bash .claude/skills/adding-a-workspace-member/scripts/check-member.sh <type-dir>/<name> --template <template>
```

It checks the package name, the paths filter entry, the Dockerfile stages, `deploy.json`, the
required files, port uniqueness, `CLAUDE.md`, and leftovers of the template's name. Fix every
`FAIL` and rerun until it prints `All checks passed.` (`--all` checks every member.)

### 7. Finish

- **README.md** (apps): run the `updating-docs` skill for this app — it owns the format and refreshes `docs/KNOWLEDGE.md`.
- **Deploy** (apps): the `onboarding-to-homelab` skill writes the homelab files and the real `deploy.json` paths.
- **Changeset**: the first release happens with the first changeset. Add one (`minor`) when the member should ship; write `.changeset/<slug>.md` by hand in a non-interactive session.
