#!/usr/bin/env bash
# Check that a workspace member is wired into everything outside its own directory.
#
# Usage (from anywhere inside the repo):
#   check-member.sh <member-path> [--template <template-member-path>]
#   check-member.sh --all
#
#   <member-path>  apis/<name>, ui/<name> or packages/<name>
#   --template     also fail on leftovers of the copied member's name
#   --all          check every member (no template check)
#
# Prints one PASS / WARN / FAIL line per check. Exit status: 1 if any FAIL.
set -uo pipefail

root=$(git rev-parse --show-toplevel) || exit 2
cd "$root" || exit 2

fails=0
pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; fails=$((fails + 1)); }

# Packages deliberately absent from paths-filter-packages.yaml: their build, lint and
# test scripts are all `true`, so a CI matrix entry would only add no-op jobs.
FILTER_EXEMPT_PACKAGES="nginx-runtime"

check_files() { # <dir> <file>...
    local dir=$1; shift
    local f
    for f in "$@"; do
        if [ -e "$dir/$f" ]; then pass "$dir/$f exists"; else fail "$dir/$f missing"; fi
    done
}

check_member() { # <member-path> [template-path]
    local path=${1%/} template=${2:-}
    local kind=${path%%/*} name=${path#*/}
    echo "== $path"

    if [ ! -d "$path" ]; then fail "$path is not a directory"; return; fi
    case "$kind" in apis|ui|packages) ;; *) fail "$path is not under apis/, ui/ or packages/"; return ;; esac
    if ! [[ "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then fail "'$name' is not kebab-case"; fi

    local expected_name=$name
    [ "$kind" = packages ] && expected_name="@radoslavirha/$name"
    local actual_name
    actual_name=$(jq -r '.name // empty' "$path/package.json" 2>/dev/null)
    if [ "$actual_name" = "$expected_name" ]; then pass "package.json name is $expected_name"
    else fail "package.json name is '${actual_name:-<none>}', expected '$expected_name'"; fi
    if [ -n "$(jq -r '.description // empty' "$path/package.json" 2>/dev/null)" ]; then pass "package.json has a description"
    else fail "package.json has no description (it becomes the image description)"; fi

    if [ "$kind" = packages ]; then
        if [[ " $FILTER_EXEMPT_PACKAGES " == *" $name "* ]]; then
            warn "$name is a known, deliberate omission from .github/paths-filter-packages.yaml (not a TypeScript package; file checks skipped)"
            return
        elif grep -qxE "${name}: packages/${name}/\*\*" .github/paths-filter-packages.yaml; then
            pass ".github/paths-filter-packages.yaml has '$name'"
        else
            fail ".github/paths-filter-packages.yaml has no '$name: packages/$name/**' — CI would build nothing for it"
        fi
        check_files "$path" tsconfig.json eslint.config.mjs vitest.config.ts src/index.ts
    else
        if grep -qxE "${path}: ${path}/\*\*" .github/paths-filter-apps.yaml; then
            pass ".github/paths-filter-apps.yaml has '$path'"
        else
            fail ".github/paths-filter-apps.yaml has no '$path: $path/**'"
        fi
        if grep -qE "^FROM .* AS build-${name}\$" Dockerfile && grep -qE "^FROM .* AS ${name}\$" Dockerfile; then
            pass "Dockerfile has build-$name and $name stages"
        else
            fail "Dockerfile lacks the build-$name and/or $name stage"
        fi
        if [ -f "$path/deploy.json" ] && jq -e 'to_entries | length > 0 and all(.value.file and .value.yamlPath)' "$path/deploy.json" >/dev/null 2>&1; then
            pass "deploy.json names a values file + yamlPath per env ($(jq -r 'keys | join(", ")' "$path/deploy.json"))"
        else
            fail "deploy.json missing or without {<env>: {file, yamlPath}} — release.yaml refuses to release the app"
        fi
        check_files "$path" README.md AGENTS.md
        if [ "$(cat "$path/CLAUDE.md" 2>/dev/null)" = "@AGENTS.md" ]; then pass "CLAUDE.md imports AGENTS.md"
        else fail "$path/CLAUDE.md must contain exactly '@AGENTS.md'"; fi
    fi

    if [ "$kind" = apis ]; then
        check_files "$path" tsconfig.json eslint.config.mjs nodemon.json .swcrc vitest.config.ts \
            config/localhost.json config/test.json \
            src/index.ts src/Server.ts src/models/config/ConfigModel.ts src/models/config/AuthMethod.enum.ts \
            src/services/ConfigService.ts src/providers/AuthProvider.ts src/health/index.ts src/otel/instrument.ts
        local port dup
        port=$(jq -r '.server.httpPort // empty' "$path/config/localhost.json" 2>/dev/null)
        if [ -z "$port" ]; then
            fail "config/localhost.json has no server.httpPort"
        else
            dup=$(for c in apis/*/config/localhost.json; do
                [ "$c" = "$path/config/localhost.json" ] && continue
                [ "$(jq -r '.server.httpPort // empty' "$c")" = "$port" ] && echo "${c%/config/localhost.json}"
            done)
            if [ -n "$dup" ]; then fail "server.httpPort $port is also used by: $dup"; else pass "server.httpPort $port is unique"; fi
        fi
    fi

    if [ "$kind" = ui ]; then
        check_files "$path" tsconfig.json eslint.config.mjs vite.config.ts vitest.config.ts index.html \
            nginx.conf nginx.conf.template public/config.json \
            src/main.tsx src/App.tsx src/test-setup.ts src/runtime/RuntimeConfig.ts src/runtime/validate-config.ts
        if grep -qE "^FROM .* AS ${name}-config-validator\$" Dockerfile; then pass "Dockerfile has the $name-config-validator stage"
        else fail "Dockerfile lacks the $name-config-validator stage (the chart's initContainer image)"; fi
        if grep -q "copyPublicDir: false" "$path/vite.config.ts" 2>/dev/null; then pass "vite.config.ts keeps public/ out of dist/"
        else fail "vite.config.ts must set build.copyPublicDir: false — dev config.json would ship in the image"; fi
        local vport vdup
        vport=$(grep -oE 'port: [0-9]+' "$path/vite.config.ts" 2>/dev/null | head -1 | grep -oE '[0-9]+')
        vdup=$(for v in ui/*/vite.config.ts; do
            [ "$v" = "$path/vite.config.ts" ] && continue
            grep -qE "port: ${vport:-none}\b" "$v" && echo "${v%/vite.config.ts}"
        done)
        if [ -z "$vport" ]; then warn "vite.config.ts sets no dev server port"
        elif [ -n "$vdup" ]; then fail "vite dev port $vport is also used by: $vdup"
        else pass "vite dev port $vport is unique"; fi
    fi

    if [ -n "$template" ]; then
        local tname=${template%/}; tname=${tname#*/}
        local hits
        hits=$(grep -rIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=dist-validator \
            --exclude-dir=coverage --exclude=CHANGELOG.md -e "$tname" "$path" 2>/dev/null)
        if [ -z "$hits" ]; then pass "no leftovers of '$tname'"
        else fail "leftovers of template '$tname' (rename or delete each):"; printf '%s\n' "$hits" | sed 's/^/      /'; fi
        if [ -e "$path/CHANGELOG.md" ]; then fail "$path/CHANGELOG.md was copied from the template — delete it"; fi
    fi
}

if [ "${1:-}" = "--all" ]; then
    for m in apis/*/ ui/*/ packages/*/; do check_member "$m"; done
elif [ -n "${1:-}" ]; then
    member=$1; template=
    if [ "${2:-}" = "--template" ]; then template=${3:-}; fi
    check_member "$member" "$template"
else
    sed -n '2,12p' "$0"; exit 2
fi

echo
if [ "$fails" -gt 0 ]; then echo "$fails check(s) failed."; exit 1; fi
echo "All checks passed."
