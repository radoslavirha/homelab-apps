---
name: onboarding-to-homelab
description: Onboards a homelab-apps API or UI to the server1 `apps` stage of the radoslavirha/homelab repo — ApplicationSet, Helm values per stage, egress NetworkPolicies, MongoDB/EMQX provisioner entries and the architecture table row — validates them with a script, and opens one PR after the user confirms. Use when the user says "onboard", "add to homelab", "create homelab deployment", "deploy new app", or describes a new app they want running in the homelab.
---

# Onboarding an app to the homelab

Writes the `radoslavirha/homelab` side of a new app and the matching `deploy.json` here.
Opening a PR in another repo is outward-facing: **nothing is pushed until the user confirms.**

## Prerequisites

`gh` authenticated with write access to `radoslavirha/homelab` (`gh auth status`), plus `helm`,
`yq` and `jq` on `PATH`.

## Scope

The server1 `apps` stage: one ApplicationSet over production + sandbox, rendered by the in-repo
`app` chart. Anything else — another cluster, a singleton like `homelab-dashboard-ui` on server3 —
is out of scope: stop and ask the user.

## Workflow

Copy this checklist and tick it off:

```
App: <name>   Kind: api|ui   Homelab template: <existing app>
- [ ] 1. Facts gathered and confirmed with the user
- [ ] 2. homelab cloned to a scratch directory
- [ ] 3. Files written (copied from the template app)
- [ ] 4. validate-app.sh passes
- [ ] 5. deploy.json here + check-member.sh passes
- [ ] 6. User confirmed the summary
- [ ] 7. One commit, branch pushed, PR opened
```

### 1. Gather facts

| Fact | Source |
| --- | --- |
| `APP` | the directory name = `package.json` `name` |
| Kind | `apis/` → API (component `api`, container port 4000); `ui/` → UI (component `apps`, port 8080) |
| Image | `ghcr.io/radoslavirha/<APP>` (`.github/workflows/docker-build-app.yaml`) |
| Config shape | API: `src/models/config/ConfigModel.ts` + `config/localhost.json`. UI: `src/runtime/RuntimeConfig.ts` + `public/config.json` |
| Backing services | MongoDB, MQTT, external HTTP APIs, IdP — from the config schema |
| `pathName` | API: `iot/<APP without -api>`; UI: `<APP without -ui>`. Confirm with the user |

Pick the homelab template app: `qr-manager-api` (MongoDB), `miot-bridge-api` (MongoDB + MQTT),
`interactive-map-feeder-api` (external HTTP only), `qr-manager-ui` (UI). Ask the user about anything
the sources do not settle. Never invent a credential.

### 2. Clone

```bash
gh repo clone radoslavirha/homelab "$TMPDIR/homelab" -- --filter=blob:none
```

### 3. Write the files

List every place the template app appears, then give the new app the same entries:

```bash
cd "$TMPDIR/homelab" && grep -rl --include='*.yaml' --include='*.md' '<template>' gitops docs
```

| File | Required when |
| --- | --- |
| `gitops/argocd-manifests/apps/apps/<PascalCase APP>.yaml` | always — copy, replace the template name in `metadata.name`, `template.metadata.name`, `releaseName`, `valueFiles`. Keep the k8s-manifests source only if the app ships raw manifests |
| `gitops/helm-values/server1/apps/<APP>/values.yaml` | always — copy the template's file whole (probes, security contexts, resources, their comments); change `image.repository`, `pathName`, ingress specifics |
| `…/values-production.yaml`, `…/values-sandbox.yaml` | always — `image.tag: "0.1.0"` (the release deploy action rewrites it), `templates.config.content` in the app's config shape, `templates.config.secrets` keyed `server1/<env>/<APP>-<group>` |
| `gitops/k8s-manifests/server1/network-policies/<env>/NetworkPolicy.egress-<APP>.yaml` | APIs — namespaces are default-deny; allow OTLP 4318 plus MongoDB 27017 / MQTT 1883 as used |
| `gitops/helm-values/server1/provisioner/mongodb.yaml` | MongoDB — a job per stage writing `<env>/<APP>-mongodb` |
| `gitops/helm-values/server1/provisioner/emqx.yaml` | MQTT — a user per stage writing `<env>/<APP>-emqx`, with topic ACLs; sandbox topics under the `sandbox/` prefix |
| `docs/architecture.md` | always — copy the template app's technology-stack row and substitute |

Config template syntax is Go templates rendered by ESO: `{{ .vars.* }}` (`protocol`, `domain`,
`cluster`, `mqtt.url`, `mongodb.url` from `vars/`), `{{ .app.* }}` (`name`, `group`, `component`,
`namespace`, `containerPort`, `pathName`, `host`), `{{ .secrets.* }}`. Follow the template app for
`httpPort: {{ .app.containerPort }}`, `publicURL`, MQTT `clientId`/`topicPrefix` and OTel blocks.

An app that verifies tokens or signs users in also needs Authentik applications in
`gitops/helm-values/server3/authentik-blueprints.yaml` — ask the user whether to include them;
if yes, check with `helm template gitops/helm-charts/authentik-blueprints -f gitops/helm-values/server3/authentik-blueprints.yaml`.

### 4. Validate — repeat until it passes

```bash
bash .claude/skills/onboarding-to-homelab/scripts/validate-app.sh "$TMPDIR/homelab" <APP> <app-dir>/config/localhost.json
```

(UI: pass `<app-dir>/public/config.json`.) It renders both stages with `helm template`, parses
each config template as JSON, matches every `.secrets.*` read to a declaration, checks OpenBao
paths stay in their stage, and checks NetworkPolicies, provisioner entries and the architecture
row. Fix each `FAIL`, rerun. Read each `WARN` and decide; say which ones you accepted.

### 5. deploy.json here

`<app-dir>/deploy.json`: `{ "<env>": { "file": "gitops/helm-values/server1/apps/<APP>/values-<env>.yaml", "yamlPath": ".image.tag" } }` for both stages. Then run
`bash .claude/skills/adding-a-workspace-member/scripts/check-member.sh <app-dir>`.

### 6. Confirm

Show the user the file list, the rendered config for production, and any accepted `WARN`.
Push only on a clear yes.

### 7. Commit and open the PR

```bash
cd "$TMPDIR/homelab"
git switch -c feat/onboard-<APP>
git add -A && git commit -m "feat: onboard <APP> to server1"
git push -u origin feat/onboard-<APP>
gh pr create -R radoslavirha/homelab --title "feat: onboard <APP> to server1" --body-file <body.md>
```

PR body: the files and why each exists; credentials the provisioners create (nothing to seed);
any **third-party** secret the user must put in OpenBao by hand (`bao kv put secret/server1/<env>/<APP>-<group> …`)
before the first sync; and that the image tag is a placeholder the first release overwrites.
