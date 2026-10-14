#!/usr/bin/env bash
# Validate a homelab-apps app's deployment files in a local clone of radoslavirha/homelab.
#
# Usage:
#   validate-app.sh <homelab-dir> <app-name> [<reference-config.json>]
#
#   <homelab-dir>            local clone of radoslavirha/homelab
#   <app-name>               e.g. sensor-bridge-api (the release name)
#   <reference-config.json>  optional: the app's own config (config/localhost.json for an API,
#                            public/config.json for a UI); keys it has and a rendered template
#                            lacks are reported as WARN
#
# Covers the server1 `apps` ArgoCD stage pattern: one ApplicationSet, values.yaml +
# values-<env>.yaml per environment the ApplicationSet lists (production + sandbox, or
# production only), vars/ loaded last. Needs helm, yq and jq.
# Prints PASS / WARN / FAIL per check. Exit status: 1 if any FAIL.
set -uo pipefail

homelab=${1:?usage: validate-app.sh <homelab-dir> <app-name> [<reference-config.json>]}
app=${2:?usage: validate-app.sh <homelab-dir> <app-name> [<reference-config.json>]}
reference=${3:-}
[ -n "$reference" ] && reference=$(cd "$(dirname "$reference")" && pwd)/$(basename "$reference")

for tool in helm yq jq; do
    command -v "$tool" >/dev/null || { echo "FAIL  $tool is not installed"; exit 1; }
done
cd "$homelab" || exit 2

fails=0
pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; fails=$((fails + 1)); }

values_dir=gitops/helm-values/server1/apps/$app
vars_dir=gitops/helm-values/server1/apps/vars
chart=gitops/helm-charts/app
policies=gitops/k8s-manifests/server1/network-policies
envs="production sandbox"

# --- ApplicationSet ---------------------------------------------------------------
appset=$(grep -lE "releaseName: ${app}\$" gitops/argocd-manifests/apps/apps/*.yaml 2>/dev/null | head -1)
if [ -z "$appset" ]; then
    fail "no ApplicationSet in gitops/argocd-manifests/apps/apps/ with 'releaseName: $app'"
else
    pass "ApplicationSet $appset"
    [ "$(yq -r '.metadata.name' "$appset")" = "$app" ] && pass "ApplicationSet metadata.name is $app" \
        || fail "ApplicationSet metadata.name is not $app"
    yq -r '.spec.template.metadata.name' "$appset" | grep -qx "${app}-{{cluster}}-{{env}}" \
        && pass "Application name template is ${app}-{{cluster}}-{{env}}" \
        || fail "spec.template.metadata.name must be ${app}-{{cluster}}-{{env}}"
    for f in "$values_dir/values.yaml" "$values_dir/values-{{env}}.yaml" "$vars_dir/common.yaml" "$vars_dir/{{env}}.yaml"; do
        grep -qF -- "\$values/$f" "$appset" && pass "ApplicationSet loads $f" || fail "ApplicationSet does not load \$values/$f"
    done
    # vars/ must come last so an app file cannot shadow a variable.
    last=$(yq -r '.spec.template.spec.sources[0].helm.valueFiles[-1]' "$appset")
    [ "$last" = "\$values/$vars_dir/{{env}}.yaml" ] && pass "vars/{{env}}.yaml is the last value file" \
        || fail "the last value file must be \$values/$vars_dir/{{env}}.yaml (is: $last)"
    # The environments are whatever the ApplicationSet generates — production + sandbox, or
    # production alone for an app whose sandbox would need state of its own.
    listed=$(yq -r '.. | select(has("env")) | .env' "$appset" 2>/dev/null | grep -xE 'production|sandbox' | sort -u | tr '\n' ' ')
    if [ -n "$listed" ]; then
        envs=$listed
        pass "ApplicationSet environments: $envs"
    else
        fail "ApplicationSet lists no env (production/sandbox) in its generators"
    fi
fi

# --- values files -----------------------------------------------------------------
for f in values.yaml $(for env in $envs; do printf 'values-%s.yaml ' "$env"; done); do
    [ -f "$values_dir/$f" ] && pass "$values_dir/$f exists" || fail "$values_dir/$f missing"
done
for env in production sandbox; do
    case " $envs " in *" $env "*) ;; *)
        [ -f "$values_dir/values-$env.yaml" ] \
            && warn "values-$env.yaml exists but the ApplicationSet does not deploy $env — stale?" ;;
    esac
done
repo=$(yq -r '.image.repository // ""' "$values_dir/values.yaml" 2>/dev/null)
[ "$repo" = "ghcr.io/radoslavirha/$app" ] && pass "image.repository is ghcr.io/radoslavirha/$app" \
    || fail "image.repository is '$repo', expected ghcr.io/radoslavirha/$app"
for env in $envs; do
    tag=$(yq -r '.image.tag // ""' "$values_dir/values-$env.yaml" 2>/dev/null)
    [ -n "$tag" ] && pass "values-$env.yaml has image.tag ($tag) — deploy.json's yamlPath points here" \
        || fail "values-$env.yaml has no image.tag — the release deploy action writes .image.tag there"
done

# --- render + config template, per env -------------------------------------------
pg_keys=""
reads_vars=""
for env in $envs; do
    f=$values_dir/values-$env.yaml
    [ -f "$f" ] || continue
    out=$(helm template "$app" "$chart" -n "$env" \
        -f "$values_dir/values.yaml" -f "$f" -f "$vars_dir/common.yaml" -f "$vars_dir/$env.yaml" 2>&1)
    if [ $? -eq 0 ]; then
        pass "helm template renders for $env ($(printf '%s\n' "$out" | grep -c '^kind:') objects)"
    else
        fail "helm template fails for $env:"; printf '%s\n' "$out" | tail -5 | sed 's/^/      /'
    fi

    content=$(yq -r '.templates.config.content // ""' "$f")
    if [ -z "$content" ]; then
        fail "$f has no templates.config.content"
        continue
    fi
    # ESO renders the Go template at runtime; replace every action with 0 — valid both inside a
    # string and as a bare value — so the JSON skeleton can be parsed here.
    skeleton=$(printf '%s' "$content" | sed -E 's/\{\{[^}]*\}\}/0/g')
    if err=$(printf '%s' "$skeleton" | jq empty 2>&1); then
        pass "values-$env.yaml config content is valid JSON once rendered"
    else
        fail "values-$env.yaml config content is not valid JSON: $err"
    fi

    # {{ .app.host }} exists only when the chart renders an HTTPRoute; ESO renders with
    # missingkey=error, so reading it in a ClusterIP-only app fails the whole config.
    if ! printf '%s\n' "$out" | grep -q '^kind: HTTPRoute'; then
        printf '%s' "$content" | grep -q '\.app\.host' \
            && fail "values-$env.yaml reads .app.host but ingress is disabled — ESO fails the render (drop publicURL or set it literally)" \
            || pass "no HTTPRoute for $env and the config does not read .app.host"
    fi
    reads_vars="$reads_vars $(printf '%s' "$content" | grep -oE '\.vars\.(mongodb|mqtt|postgres)' | sed 's/\.vars\.//' | tr '\n' ' ')"

    used=$(printf '%s' "$content" | grep -oE '\.secrets\.[A-Za-z0-9_]+' | sed 's/\.secrets\.//' | sort -u)
    declared=$(yq -r '.templates.config.secrets // {} | keys | .[]' "$f" | sort -u)
    for k in $used; do
        printf '%s\n' "$declared" | grep -qx "$k" && pass "secret '$k' is declared for $env" \
            || fail "content reads .secrets.$k but values-$env.yaml declares no templates.config.secrets.$k"
    done
    for k in $declared; do
        printf '%s\n' "$used" | grep -qx "$k" || warn "secret '$k' is declared for $env but never read by the content"
        key=$(yq -r ".templates.config.secrets.$k.key" "$f")
        case "$key" in
            server1/$env/*) pass "secret '$k' reads OpenBao server1/$env/…" ;;
            # A CloudNativePG role password: generated by a PushSecret in the postgres namespace,
            # cluster-scoped by path, so the environment check moves to the end (one role per env).
            server1/postgres/*)
                if grep -rqF "remoteKey: $key" gitops/k8s-manifests/server1/postgres/ 2>/dev/null; then
                    pass "secret '$k' reads $key, generated by a PushSecret in gitops/k8s-manifests/server1/postgres/"
                    pg_keys="$pg_keys $key"
                else
                    fail "secret '$k' reads $key but no PushSecret in gitops/k8s-manifests/server1/postgres/ writes it"
                fi ;;
            *) fail "secret '$k' key '$key' must start with server1/$env/ — a stage reading another stage's secret" ;;
        esac
    done

    if [ -n "$reference" ] && [ -f "$reference" ]; then
        missing=$(jq -r --argjson t "$(printf '%s' "$skeleton" | jq -c . 2>/dev/null || echo '{}')" \
            '[paths(scalars) | map(tostring) | join(".")] - [$t | paths(scalars) | map(tostring) | join(".")] | .[]' \
            "$reference" | grep -vE '^auth\.|\.[0-9]+(\.|$)')
        if [ -z "$missing" ]; then pass "values-$env.yaml covers every key of $(basename "$reference")"
        else warn "keys in $(basename "$reference") not in values-$env.yaml (intended?): $(printf '%s' "$missing" | tr '\n' ' ')"; fi
    fi
done
dup=$(printf '%s\n' $pg_keys | sort | uniq -d)
[ -n "$dup" ] && fail "more than one environment reads $dup — each environment needs a database role of its own"

# --- surrounding files ------------------------------------------------------------
component=$(yq -r '.labels.component // ""' "$values_dir/values.yaml" 2>/dev/null)
if [ "$component" = api ]; then
    # One per environment the ApplicationSet deploys. A production-only app has no sandbox
    # copy (homelab network-egress skill, fact 1); a stray one would select nothing.
    for env in $envs; do
        p=$policies/$env/NetworkPolicy.egress-$app.yaml
        [ -f "$p" ] && pass "$p exists" \
            || fail "$p missing — server1 namespaces are default-deny; without it the API cannot reach OTLP, MongoDB, MQTT or Postgres"
    done
    for env in production sandbox; do
        case " $envs " in *" $env "*) continue ;; esac
        ls "$policies/$env/"NetworkPolicy.egress*"$app"*.yaml >/dev/null 2>&1 \
            && warn "$policies/$env/ has a policy for $app, which the ApplicationSet does not deploy there"
    done
    p=$policies/production/NetworkPolicy.egress-$app.yaml
    # Each datastore variable the config reads needs its namespace and port in the app's policy.
    for dep in "mongodb mongodb 27017" "mqtt iot 1883" "postgres postgres 5432"; do
        set -- $dep
        case " $reads_vars " in *" $1 "*) ;; *) continue ;; esac
        if [ -f "$p" ] && grep -q "kubernetes.io/metadata.name: $2" "$p" && grep -q "port: $3" "$p"; then
            pass "egress policy reaches namespace $2 on $3 (the config reads .vars.$1)"
        else
            fail "the config reads .vars.$1 but $p allows no egress to namespace $2 on $3"
        fi
    done
    grep -qF "| \`$app\` |" docs/network-egress.md && pass "docs/network-egress.md lists $app" \
        || fail "docs/network-egress.md has no per-app row for \`$app\` — the network-egress skill updates it with the policy"
    grep -qE "^\| ${app} \| " <(sed -n '/^## ServiceAccounts/,/^## /p' docs/architecture.md) \
        && pass "docs/architecture.md ServiceAccounts table lists $app" \
        || warn "docs/architecture.md ServiceAccounts table has no row for $app"
fi
if grep -q '\.secrets\.mongodb' "$values_dir/values-production.yaml" 2>/dev/null; then
    grep -q "baoPath: production/$app-mongodb" gitops/helm-values/server1/provisioner/mongodb.yaml \
        && pass "MongoDB provisioner has jobs for $app" \
        || fail "uses MongoDB secrets but gitops/helm-values/server1/provisioner/mongodb.yaml has no baoPath production/$app-mongodb"
fi
if grep -q '\.secrets\.mqtt' "$values_dir/values-production.yaml" 2>/dev/null; then
    grep -q "baoPath: production/$app-emqx" gitops/helm-values/server1/provisioner/emqx.yaml \
        && pass "EMQX provisioner has users for $app" \
        || fail "uses MQTT secrets but gitops/helm-values/server1/provisioner/emqx.yaml has no baoPath production/$app-emqx"
fi
grep -qE "^\| ${app} \|" docs/architecture.md && pass "docs/architecture.md has a row for $app" \
    || fail "docs/architecture.md has no technology-stack row starting '| $app |'"

echo
if [ "$fails" -gt 0 ]; then echo "$fails check(s) failed."; exit 1; fi
echo "All checks passed."
