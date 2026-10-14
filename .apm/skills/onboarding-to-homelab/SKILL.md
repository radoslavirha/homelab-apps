---
name: onboarding-to-homelab
description: Onboards a homelab-apps API or UI to the server1 `apps` ArgoCD stage of the radoslavirha/homelab repo — ApplicationSet, Helm values per environment (production + sandbox, or production only), egress NetworkPolicies, MongoDB/EMQX provisioner entries or a Postgres role, Authentik roles, docs rows — validates them with a script, and opens one PR after the user confirms. Use when the user says "onboard", "add to homelab", "create homelab deployment", "deploy new app", or describes a new app they want running in the homelab.
---

# Onboarding an app to the homelab

Writes the `radoslavirha/homelab` side of a new app and the matching `deploy.json` here.
Opening a PR in another repo is outward-facing: **nothing is pushed until the user confirms.**

Two words, as homelab uses them: an **environment** is `production` or `sandbox` (a namespace on
server1); an **ArgoCD stage** is an App-of-Apps — this skill writes into the `apps` one.

homelab's own skills are named below by name; they are not loaded in this repo. Read them from the
clone: `$TMPDIR/homelab/.apm/skills/<name>/SKILL.md`.

## Prerequisites

`gh` authenticated with write access to `radoslavirha/homelab` (`gh auth status`), plus `helm`,
`yq` and `jq` on `PATH`.

## Scope

The server1 `apps` ArgoCD stage: one ApplicationSet, rendered by the in-repo `app` chart, over
production + sandbox — or production alone when a sandbox would need state of its own (a database,
an index) that the user has not asked for. Anything else — another cluster, a singleton like
`homelab-dashboard-ui` on server3 — is out of scope: stop and ask the user.

## Workflow

Copy this checklist and tick it off:

```
App: <name>   Kind: api|ui   Environments: production+sandbox|production   Template: <existing app>
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
| Backing services | MongoDB, MQTT, Postgres, external HTTP APIs, LAN hosts, IdP — from the config schema |
| Environments | production + sandbox by default. Production only when sandbox would need its own database or index — ask |
| Exposure | an HTTPRoute (the default), or ClusterIP only for an internal service no person browses — ask |
| `pathName` | only with a route. API: `iot/<APP without -api>` for the IoT apps; UI: `<APP without -ui>`. Confirm with the user |

Pick the homelab template app: `qr-manager-api` (MongoDB), `miot-bridge-api` (MongoDB + MQTT),
`interactive-map-feeder-api` (external HTTP only), `qr-manager-ui` (UI). Postgres and ClusterIP-only
have no template app yet; the rows below say what changes. Ask the user about anything the sources
do not settle. Never invent a credential.

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
| `gitops/argocd-manifests/apps/apps/<PascalCase APP>.yaml` | always — copy, replace the template name in `metadata.name`, `template.metadata.name`, `releaseName`, `valueFiles`. Production only: drop the `- env: sandbox` element. Keep the k8s-manifests source only if the app ships raw manifests |
| `gitops/helm-values/server1/apps/<APP>/values.yaml` | always — copy the template's file whole (probes, security contexts, resources, their comments); change `image.repository`, `labels.partOf` (the template's is `iot`), `pathName`, ingress specifics. ClusterIP only: `ingress: { enabled: false, serviceRef: http }` — `serviceRef` stays, `{{ .app.containerPort }}` is read from it |
| `…/values-<env>.yaml` | one per environment the ApplicationSet lists — `image.tag: "0.1.0"` (the release deploy action rewrites it), `templates.config.content` in the app's config shape, `templates.config.secrets` keyed `server1/<env>/<APP>-<group>`; a Postgres role's password is `server1/postgres/<role>`, property `password` |
| `gitops/k8s-manifests/server1/network-policies/<env>/NetworkPolicy.egress-<APP>.yaml` | APIs — one per environment the ApplicationSet deploys; a production-only app has none in `sandbox/`. Namespaces are default-deny: allow OTLP 4318 plus MongoDB 27017 / MQTT 1883 / Postgres 5432 (namespace `postgres`, label `cnpg.io/cluster: postgres`) as used. A LAN host gets its own `NetworkPolicy.egress-lan-<what>.yaml`. Internet 80/443 and the IdP are already allowed namespace-wide. Add the app's rows to `docs/network-egress.md`. Rules: homelab's `network-egress` skill |
| `gitops/helm-values/server1/provisioner/mongodb.yaml` | MongoDB — a job per environment writing `<env>/<APP>-mongodb` |
| `gitops/helm-values/server1/provisioner/emqx.yaml` | MQTT — a user per environment writing `<env>/<APP>-emqx`, with topic ACLs; sandbox topics under the `sandbox/` prefix |
| `gitops/k8s-manifests/server1/postgres/` | Postgres, unless the role exists — copy the `knowledge-base` set (`Database`, `DatabaseRole`, `PushSecret`, `ExternalSecret`) per role, one role per environment. It creates a database: say so to the user. After the first sync one `REVOKE CONNECT` by hand — homelab `docs/secrets.md` § server1/postgres |
| `gitops/helm-values/server3/authentik-blueprints.yaml` | an app that verifies tokens or signs users in — see below |
| `docs/architecture.md` | always — the template app's technology-stack row and, for an API, its ServiceAccounts row |
| `docs/secrets.md` | a secret a person seeds by hand — a quick-reference row and a section with the `bao kv put` |

Config template syntax is Go templates rendered by ESO: `{{ .vars.* }}` (`protocol`, `domain`,
`cluster`, `mqtt.url`, `mongodb.url`, `postgres.host`, `postgres.port` from `vars/`), `{{ .app.* }}`
(`name`, `group`, `component`, `namespace`, `containerPort`, `pathName`, and `host` — only when the
app has a route), `{{ .secrets.* }}`. Follow the template app for
`httpPort: {{ .app.containerPort }}`, `publicURL`, MQTT `clientId`/`topicPrefix` and OTel blocks.
ESO fails the whole render on a missing key, so a ClusterIP-only app drops `publicURL` (it is
optional). A multi-line secret (a PEM key) goes in unquoted as `{{ .secrets.<name> | toJson }}`.

**Authentik.** Ask the user whether the app gets applications and roles; if yes, follow homelab's
`authentik-blueprints` skill — merging the PR does not apply a blueprint, and that skill carries the
check that Authentik did. Each trusted issuer (the app's own, Postman's, a device's) is one row
under `auth.IDP.trustedIssuers` in `values-<env>.yaml`.

### 4. Validate — repeat until it passes

```bash
bash .claude/skills/onboarding-to-homelab/scripts/validate-app.sh "$TMPDIR/homelab" <APP> <app-dir>/config/localhost.json
```

(UI: pass `<app-dir>/public/config.json`.) It reads the environments from the ApplicationSet,
renders each with `helm template`, parses each config template as JSON, matches every `.secrets.*`
read to a declaration, checks OpenBao paths stay in their environment (a Postgres role's path must
be one a PushSecret writes, read by one environment only), refuses `.app.host` without a route, and
checks NetworkPolicies (and that each datastore the config reads is reachable), provisioner entries
and the docs rows. Fix each `FAIL`, rerun. Read each `WARN` and decide; say which ones you accepted.

### 5. deploy.json here

`<app-dir>/deploy.json`: `{ "<env>": { "file": "gitops/helm-values/server1/apps/<APP>/values-<env>.yaml", "yamlPath": ".image.tag" } }`
for each environment the ApplicationSet lists — the release workflow skips an environment that is
not there. Then run `bash .claude/skills/adding-a-workspace-member/scripts/check-member.sh <app-dir>`.

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

PR body:

- the files and why each exists;
- credentials a machine creates (provisioners, a Postgres PushSecret — nothing to seed);
- any **third-party** secret the user must put in OpenBao by hand
  (`bao kv put secret/server1/<env>/<APP>-<group> …`) **before the first sync**;
- **after merge**, in this order: the `network-policies-server1-<env>` Applications are manual-sync —
  sync sandbox, then production (or production alone), once each (homelab `network-egress` skill), or
  the new pods' egress is dropped; the `authentik-server3` sync and apply check, if blueprints changed; the `REVOKE CONNECT`,
  if a database was added;
- that the image tag is a placeholder the first release overwrites.
