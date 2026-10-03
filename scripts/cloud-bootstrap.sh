#!/usr/bin/env bash
# Prepare a fresh clone for a Claude Code cloud session or routine.
#
# The cloud environment's setup script provisions the toolchain (Node 24,
# pnpm 11, apm, the MongoDB image) and is cached, so it never sees the
# per-session clone. This script does the per-clone part, mirroring
# .github/actions/prepare: registry auth, install, build, and the gitignored
# .claude/ tree that `apm install` restores from apm.lock.yaml.
#
# Requires NODE_AUTH_TOKEN (a token with read:packages) in the environment,
# because every @radoslavirha/* package comes from GitHub Packages.
#
# Usage:
#   bash scripts/cloud-bootstrap.sh
set -euo pipefail

cd "$(dirname "$0")/.."

node_major=$(node -p 'process.versions.node.split(".")[0]')
if (( node_major < 24 )); then
    echo "Node 24+ required, got $(node -v) — check the environment setup script" >&2
    exit 1
fi

for tool in pnpm apm; do
    command -v "$tool" >/dev/null || {
        echo "$tool not on PATH — check the environment setup script" >&2
        exit 1
    }
done

if [[ -z "${NODE_AUTH_TOKEN:-}" ]]; then
    echo "NODE_AUTH_TOKEN is not set — add it to the cloud environment's variables" >&2
    exit 1
fi

echo "node $(node -v), pnpm $(pnpm -v), $(apm --version)"

# Same as .github/actions/prepare: .npmrc maps the scope, the token lives in user config.
pnpm config set //npm.pkg.github.com/:_authToken "$NODE_AUTH_TOKEN"

# qr-manager-api, tsed-health and resilience tests start MongoDB through
# testcontainers. Docker is installed in the cloud image but the daemon isn't
# running, and the environment cache keeps files, not processes — so start it
# on every cloud run. Locally, only report whether a daemon is reachable.
docker_ok() { timeout 5 docker info >/dev/null 2>&1; }

start_docker() {
    docker_ok && return 0
    [[ "${CLAUDE_CODE_REMOTE:-}" == "true" ]] || return 1
    local sudo=""
    [[ "$(id -u)" != 0 ]] && command -v sudo >/dev/null && sudo="sudo"
    # The environment snapshot can carry a stale pid file and socket from the
    # setup script's daemon, which stop a new one from starting.
    $sudo rm -f /var/run/docker.pid /var/run/docker.sock
    # Background only dockerd, with no inherited stdio: a backgrounded group
    # would keep this script's output pipe open, and the caller would wait on
    # it for as long as the daemon runs.
    $sudo setsid nohup dockerd >/tmp/dockerd.log 2>&1 </dev/null &
    for _ in $(seq 1 30); do
        docker_ok && return 0
        sleep 1
    done
    return 1
}

echo "starting docker..."
if command -v docker >/dev/null && start_docker; then
    echo "docker $(docker version --format '{{.Server.Version}}')"
else
    echo "WARN: Docker daemon unavailable — Mongo-backed tests will fail for environment reasons, not bugs (see /tmp/dockerd.log)" >&2
fi

pnpm install --frozen-lockfile
# Apps and packages resolve sibling workspace packages through dist/.
pnpm build

# Toolkit-hub skills come from GitHub through apm. If that fails, fetch their
# sources over raw.githubusercontent.com so agents can still read them.
if ! apm install; then
    echo "WARN: apm install failed — fetching toolkit-hub skills into /tmp/toolkit-skills" >&2
    base=https://raw.githubusercontent.com/radoslavirha/toolkit-hub/main
    for path in \
        apm-plugins/adoption/.apm/skills/adopting-toolkit-hub \
        apm-plugins/tsed-service/.apm/skills/building-a-tsed-service \
        config/config-eslint/.apm/skills/using-config-eslint \
        config/config-tsdown/.apm/skills/using-config-tsdown \
        config/config-typescript/.apm/skills/using-config-typescript \
        config/config-vitest/.apm/skills/using-config-vitest \
        packages/redaction/.apm/skills/using-redaction \
        packages/utils/.apm/skills/using-utils \
        tsed/common/.apm/skills/using-tsed-common \
        tsed/configuration/.apm/skills/using-tsed-configuration \
        tsed/logger/.apm/skills/using-tsed-logger \
        tsed/mongoose/.apm/skills/using-tsed-mongoose \
        tsed/platform/.apm/skills/using-tsed-platform \
        tsed/swagger/.apm/skills/using-tsed-swagger; do
        name=$(basename "$path")
        mkdir -p "/tmp/toolkit-skills/$name"
        curl -fsSL "$base/$path/SKILL.md" -o "/tmp/toolkit-skills/$name/SKILL.md" \
            || echo "WARN: could not fetch $name" >&2
    done
fi
