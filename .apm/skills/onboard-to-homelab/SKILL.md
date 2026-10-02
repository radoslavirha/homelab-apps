---
name: onboard-to-homelab
description: Scaffold full ArgoCD/homelab deployment for a new homelab-apps app. Use when user says "onboard", "add to homelab", "create homelab deployment", "deploy new app", or starts describing a new app they want running in the homelab.
---

# Onboard App to Homelab

Scaffold full ArgoCD deployment in the homelab repo for a new app in this monorepo.
Opens a PR in `radoslavirha/homelab` with all required files.

## Step 1 — Identify the app

Determine which app to onboard:
- If user named an app (e.g. "onboard new-sensor-api"), use that.
- Otherwise, infer from current working directory or ask the user.
- App directory: `apis/<app-name>/` or `ui/<app-name>/` in this repo.

## Step 2 — Read app context from this repo

Read the following (paths relative to the app directory unless noted):

1. **AGENTS.md** — description, image name, secret group names, config structure notes
2. **Root `Dockerfile`**, the app's stage — `EXPOSE` line (HTTP port)
3. **`src/models/config/ConfigModel.ts`** and `config/localhost.json` (APIs) or `public/config.example.json` (UIs) — full config structure for the config template
4. **The config schema** — which fields are credentials (passwords, usernames, tokens); those become `templates.config.secrets`

From these, extract:
- `APP_NAME`: kebab-case app name (e.g. `new-sensor-api`)
- `CLUSTER`: the cluster existing apps run on — read it from the Step 3 ApplicationSet generator (currently `server1`)
- `APPSET_NAME`: PascalCase of `APP_NAME` (e.g. `NewSensorApi`)
- `IMAGE`: image repository from AGENTS.md (e.g. `ghcr.io/radoslavirha/new-sensor-api`)
- `HTTP_PORT`: from Dockerfile EXPOSE (default: 4000)
- `SECRET_GROUPS`: list of credential groups, each with:
  - `name`: group identifier (e.g. `mqtt`, `mongodb`)
  - `bao_path_suffix`: OpenBao path suffix from AGENTS.md (e.g. `new-sensor-api-emqx`)
  - `keys`: list of `{ name, property }` pairs — `name` is the camelCase key the template reads as `.secrets.<name>`

If anything is ambiguous or missing from the above sources, ask the user before proceeding.

## Step 3 — Read homelab template patterns via GitHub MCP

Read these files from `radoslavirha/homelab` (branch: `main`) to use as structural templates:

1. `gitops/argocd-manifests/apps/apps/MiotBridgeApi.yaml` — ApplicationSet structure (cluster × env matrix, `valueFiles`)
2. `gitops/helm-values/server1/apps/miot-bridge-api/values.yaml` — shared values
3. `gitops/helm-values/server1/apps/miot-bridge-api/values-production.yaml` — production config template + `secrets`
4. `gitops/helm-values/server1/apps/miot-bridge-api/values-sandbox.yaml` — sandbox config template + `secrets`
5. `gitops/helm-values/server1/apps/vars/` — the `vars:` every template can read
6. `gitops/helm-charts/app/Readme.md` — the chart: one app per release, template variables, `validate`
7. `docs/architecture.md` — technology stack table (to append a new row)

## Step 4 — Generate all files

Use Step 3 templates as structural guides. Substitute the new app's values everywhere.

The `app` chart deploys ONE app per release: the release name (`helm.releaseName`) is the app name, and every value is top-level — there is no `apps:` wrapper.

### A. ArgoCD ApplicationSet
**File:** `gitops/argocd-manifests/apps/apps/<APPSET_NAME>.yaml`

Copy MiotBridgeApi.yaml. Substitute every `miot-bridge-api` with `<APP_NAME>` — `metadata.name`, `template.metadata.name`, `helm.releaseName` and the `valueFiles` paths. Keep the generators and the two `vars/` value files as they are. Keep the third `sources` block (k8s-manifests) only if the app ships raw manifests of its own; config secrets do NOT need it.

### B. Helm shared values
**File:** `gitops/helm-values/server1/apps/<APP_NAME>/values.yaml`

```yaml
# <APP_NAME> — shared values

annotations:
  reloader.stakater.com/auto: "true"   # restart when the rendered config changes
image:
  repository: <IMAGE>
  tag: "0.1.0"          # the homelab-apps deploy action bumps this in values-<env>.yaml
  pullPolicy: Always
replicas: 1
resources:
  requests:
    cpu: 250m
    memory: 250Mi
  limits:
    cpu: 500m
    memory: 500Mi
labels:
  component: api
  partOf: iot
services:
  http:
    enabled: true
    protocol: TCP
    port: 80
    targetPort: <HTTP_PORT>
ingress:
  enabled: true
  serviceRef: http
  pathName: iot/<APP_NAME>
templates:
  config:
    file: production.json
    path: /home/app/config
    # content and secrets defined per-env
```

Copy probes, `lifecycle`, `strategy` and the security contexts from miot-bridge-api's `values.yaml`.

### C. Helm production values
**File:** `gitops/helm-values/server1/apps/<APP_NAME>/values-production.yaml`

`image.tag`, then `templates.config.content` as inline JSON using the config schema from Step 2, and `templates.config.secrets` when the app has credentials.

Template syntax is Go templates (the same as Helm), rendered by ESO. The prefix says where a value comes from:
- `{{ .vars.* }}` — `gitops/helm-values/server1/apps/vars/`: `protocol`, `domain`, `cluster`, `mqtt.url`, `mongodb.url`
- `{{ .app.* }}` — chart built-ins: `name`, `group`, `component`, `namespace`, `containerPort`, `pathName`, `host` (the HTTPRoute hostname)
- `{{ .secrets.* }}` — the keys of `templates.config.secrets`; pipe passwords through `toJson` (`"pass": {{ .secrets.mongodbPassword | toJson }}`)

Conventions (follow miot-bridge-api exactly):
- `httpPort`: `{{ .app.containerPort }}`
- publicURL: `{{ .vars.protocol }}://{{ .app.host }}/{{ .app.pathName }}` — identical in both stages, `vars.domain` carries the stage
- MQTT clientId: `<APP_NAME>-production`; topicPrefix: `{{ .app.group }}/`
- OTel debug: omit (false by default)

Secrets, one entry per credential:
```yaml
templates:
  config:
    secrets:
      mongodbPassword:
        key: <CLUSTER>/production/<bao_path_suffix>
        property: mongodb-password
```

### D. Helm sandbox values
**File:** `gitops/helm-values/server1/apps/<APP_NAME>/values-sandbox.yaml`

Same as production with these sandbox differences:
- `secrets[].key`: `<CLUSTER>/sandbox/<bao_path_suffix>`
- MQTT clientId: `<APP_NAME>-sandbox`; topicPrefix: `{{ .app.group }}/{{ .app.namespace }}/`
- OTel `debug: true`

### E. homelab-apps deploy.json
In THIS repo, `<app dir>/deploy.json` — one entry per env: `"file": "gitops/helm-values/server1/apps/<APP_NAME>/values-<env>.yaml"`, `"yamlPath": ".image.tag"`.

### F. docs/architecture.md row
Read the current technology stack table in `docs/architecture.md`. Append a row following the existing format:

```
| <APP_DESCRIPTION> | <CLUSTER> | ArgoCD (AppSet) | [`radoslavirha/<IMAGE_NAME>`](https://hub.docker.com/r/radoslavirha/<IMAGE_NAME>) | [values](gitops/helm-values/server1/apps/<APP_NAME>/values.yaml) · [prod](gitops/helm-values/server1/apps/<APP_NAME>/values-production.yaml) · [sbx](gitops/helm-values/server1/apps/<APP_NAME>/values-sandbox.yaml) | — |
```

## Step 5 — Create branch + push all files via GitHub MCP

1. Create branch in `radoslavirha/homelab`: `feat/onboard-<APP_NAME>` (base: `main`)
2. Push each file via `create_or_update_file`:
   - Commit message per file: `feat: scaffold <APP_NAME> — <filename>`
   - Or batch into fewer commits if the MCP tool supports multi-file commits
3. Confirm all files are pushed before opening PR

## Step 6 — Open PR in radoslavirha/homelab

- **Title:** `feat: onboard <APP_NAME> to <CLUSTER>`
- **Body:**

```markdown
## Onboard <APP_NAME>

Scaffolded by agent from `radoslavirha/homelab-apps`.

### Files generated
- `gitops/argocd-manifests/apps/apps/<APPSET_NAME>.yaml`
- `gitops/helm-values/server1/apps/<APP_NAME>/values.yaml`
- `gitops/helm-values/server1/apps/<APP_NAME>/values-production.yaml`
- `gitops/helm-values/server1/apps/<APP_NAME>/values-sandbox.yaml`
- `docs/architecture.md` (new row)

### TODO before first ArgoCD sync — seed OpenBao secrets

```sh
# production
bao kv put secret/<CLUSTER>/production/<bao_path_suffix_1> <key1>=<value> <key2>=<value>
bao kv put secret/<CLUSTER>/production/<bao_path_suffix_2> ...

# sandbox
bao kv put secret/<CLUSTER>/sandbox/<bao_path_suffix_1> ...
bao kv put secret/<CLUSTER>/sandbox/<bao_path_suffix_2> ...
```

### Notes
- Image tag `"0.1.0"` is a placeholder — GitHub Actions will overwrite on first release
```

## Notes
- Never generate secrets or real credentials — only `templates.config.secrets` entries that reference OpenBao paths
- If the app config schema is complex or ambiguous, show the generated JSON template to the user for review before pushing
- Image tag is always `"0.1.0"` — do not try to detect or query a real version
