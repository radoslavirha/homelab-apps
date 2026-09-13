ARG BUILD_FROM=node:24-trixie-slim

# hadolint ignore=DL3006
FROM $BUILD_FROM AS base

LABEL maintainer="radoslav.irha@gmail.com"
ENV LANG=C.UTF-8
RUN npm install -g pnpm@12

# Runtime base for the API images: the Node runtime and nothing else. Deliberately
# NOT built from `base`, which carries a global pnpm install that has no business in
# a running pod. The rules these stages encode are in AGENTS.md § Adding a New API.
#
# Google distroless, NOT node:24-trixie-slim: no shell, no package manager, no libc
# tooling — 10 dpkg packages instead of 79 (measured, 2026-09-13). Everything the app
# needs at runtime is the node binary, glibc and libssl, and that is all this carries.
#
# Three things about this base are load-bearing:
#
#  1. ENTRYPOINT is already ["/nodejs/bin/node"], so CMD carries *arguments to node*,
#     not a command line. The `node` word is dropped from every CMD below; the
#     `--import .../instrument.js` preload has to survive that move or traces and
#     every trace_id in the logs silently stop.
#  2. USER is 65532 (nonroot), not 1000. It is numeric, which is what Kubernetes
#     needs to verify runAsNonRoot — the kubelet does not read the image's
#     /etc/passwd, so a named user fails closed with CreateContainerConfigError.
#     The three charts in the homelab repo pin runAsUser/runAsGroup/fsGroup 1000 and
#     MUST move to 65532 in the same rollout.
#  3. `node` is not on PATH (it lives at /nodejs/bin/node) and there is no shell, so
#     `kubectl exec -- node -e ...` must be spelled `-- /nodejs/bin/node -e ...`.
#
# The image already ships /etc/ssl/certs/ca-certificates.crt and sets SSL_CERT_FILE,
# so outbound HTTPS (miot-spec.org, CHMI) works without adding a ca-certificates layer.
FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runtime-base

LABEL maintainer="radoslav.irha@gmail.com"
ENV LANG=C.UTF-8 \
    NODE_ENV=production
WORKDIR /home/app
USER 65532

FROM base AS deps

WORKDIR /usr/src/app
COPY . .
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm install --frozen-lockfile
RUN pnpm --filter './packages/**' run build

# ─── interactive-map-feeder-api ────────────────────────────────────────────────────
FROM deps AS build-interactive-map-feeder-api

RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm --filter=interactive-map-feeder-api run build && \
    pnpm deploy --filter=interactive-map-feeder-api --prod /prod/interactive-map-feeder-api

FROM runtime-base AS interactive-map-feeder-api

COPY --from=build-interactive-map-feeder-api --chown=65532:65532 /prod/interactive-map-feeder-api /home/app
# No `node` here: the distroless ENTRYPOINT is the node binary, CMD is its argv.
CMD ["--import", "/home/app/dist/otel/instrument.js", "dist/index.js"]

# ─── miot-bridge-api ───────────────────────────────────────────────────────────────
FROM deps AS build-miot-bridge-api

RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm --filter=miot-bridge-api run build && \
    pnpm deploy --filter=miot-bridge-api --prod /prod/miot-bridge-api

FROM runtime-base AS miot-bridge-api

COPY --from=build-miot-bridge-api --chown=65532:65532 /prod/miot-bridge-api /home/app
# No `node` here: the distroless ENTRYPOINT is the node binary, CMD is its argv.
CMD ["--import", "/home/app/dist/otel/instrument.js", "dist/index.js"]

# ─── qr-manager-api ────────────────────────────────────────────────────────────
FROM deps AS build-qr-manager-api

RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm --filter=qr-manager-api run build && \
    pnpm deploy --filter=qr-manager-api --prod /prod/qr-manager-api

FROM runtime-base AS qr-manager-api

COPY --from=build-qr-manager-api --chown=65532:65532 /prod/qr-manager-api /home/app
# No `node` here: the distroless ENTRYPOINT is the node binary, CMD is its argv.
CMD ["--import", "/home/app/dist/otel/instrument.js", "dist/index.js"]

# ─── homelab-dashboard-ui ──────────────────────────────────────────────────────
FROM deps AS build-homelab-dashboard-ui

RUN pnpm --filter=homelab-dashboard-ui run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS homelab-dashboard-ui

# Unprivileged variant: nginx runs as UID 101 and binds 8080, because a non-root
# process cannot bind a port below 1024. Same upstream image otherwise — same
# entrypoint, same /docker-entrypoint.d pipeline, same STOPSIGNAL SIGQUIT.
#
# USER 0 is only for the package install and the chmod below; the image's own
# USER 101 is restored before anything runs. Both are numeric because hadolint
# DL3066 rejects a name here, and because Kubernetes verifies runAsNonRoot
# against the image's configured user and cannot resolve a username — a named
# user fails closed with CreateContainerConfigError.
USER 0

# Pinned per hadolint DL3018. Alpine keeps only the current revision of a
# package, so this pin rots the moment upstream bumps it: 1.8.1-r0 vanished and
# every image build failed with "unable to select packages". A renovate custom
# regex manager now proposes bumps against the `apk` datasource, so this should
# arrive as a PR rather than as a red build — but the Alpine branch it queries
# (v3.23, this base image's) is hand-maintained in renovate.json. If
# nginx-unprivileged moves to a newer Alpine, that manager keeps offering valid
# v3.23 versions instead of erroring, and this pin silently stops tracking.
RUN apk add --no-cache jq=1.8.2-r0

# dist/ carries no config.json: vite.config.ts sets build.copyPublicDir false so
# the development config — placeholder API key included — never enters the image.
COPY --from=build-homelab-dashboard-ui /usr/src/app/ui/homelab-dashboard-ui/dist /usr/share/nginx/html
COPY packages/nginx-runtime/conf.d/healthz.conf /etc/nginx/snippets/healthz.conf
COPY packages/nginx-runtime/docker-entrypoint.d/05-validate-runtime-config.sh /docker-entrypoint.d/
COPY ui/homelab-dashboard-ui/docker-entrypoint.d/10-require-unifi-env.sh /docker-entrypoint.d/
# The stock entrypoint renders /etc/nginx/templates/*.template into conf.d.
COPY ui/homelab-dashboard-ui/nginx.conf.template /etc/nginx/templates/default.conf.template
RUN chmod +x /docker-entrypoint.d/05-validate-runtime-config.sh /docker-entrypoint.d/10-require-unifi-env.sh
USER 101
EXPOSE 8080
# ENTRYPOINT / CMD / STOPSIGNAL are inherited from the base image on purpose:
# STOPSIGNAL SIGQUIT is what makes nginx shut down gracefully instead of
# dropping in-flight requests, and the stock entrypoint keeps nginx as PID 1.
# See rule F4 in docs/superpowers/specs/2026-08-06-iot-app-health-checks-frontend.md.

# ─── homelab-dashboard-ui-config-validator ─────────────────────────────────────
FROM deps AS build-homelab-dashboard-ui-validator

RUN pnpm --filter=homelab-dashboard-ui run build:validator

FROM node:24-alpine AS homelab-dashboard-ui-config-validator

COPY --from=build-homelab-dashboard-ui-validator \
     /usr/src/app/ui/homelab-dashboard-ui/dist-validator/validate-config.js /app/validate-config.js
# Reads one file and exits — nothing here needs root.
#
# Numeric UID, NOT `node`. Kubernetes verifies runAsNonRoot against the image's
# configured user, and cannot map a username to a UID — that mapping lives in
# the image's /etc/passwd, which the kubelet does not read. With `USER node` it
# fails closed: CreateContainerConfigError "container has runAsNonRoot and image
# has non-numeric user (node), cannot verify user is non-root", and the pod never
# leaves Init. 1000 is the node user in node:*-alpine.
USER 1000
ENTRYPOINT ["node", "/app/validate-config.js"]
# Local-run convenience only. In-cluster the chart supplies the path as an arg,
# derived from templates.<name>.file — never hardcode a filename here.
CMD ["/config/config.json"]

# ─── qr-manager-ui ─────────────────────────────────────────────────────────────
FROM deps AS build-qr-manager-ui

RUN pnpm --filter=qr-manager-ui run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS qr-manager-ui

# Unprivileged variant: nginx runs as UID 101 and binds 8080, because a non-root
# process cannot bind a port below 1024. Same upstream image otherwise — same
# entrypoint, same /docker-entrypoint.d pipeline, same STOPSIGNAL SIGQUIT.
#
# USER 0 is only for the package install and the chmod below; the image's own
# USER 101 is restored before anything runs. Both are numeric because hadolint
# DL3066 rejects a name here, and because Kubernetes verifies runAsNonRoot
# against the image's configured user and cannot resolve a username — a named
# user fails closed with CreateContainerConfigError.
USER 0

# Pinned per hadolint DL3018. Alpine keeps only the current revision of a
# package, so this pin rots the moment upstream bumps it: 1.8.1-r0 vanished and
# every image build failed with "unable to select packages". A renovate custom
# regex manager now proposes bumps against the `apk` datasource, so this should
# arrive as a PR rather than as a red build — but the Alpine branch it queries
# (v3.23, this base image's) is hand-maintained in renovate.json. If
# nginx-unprivileged moves to a newer Alpine, that manager keeps offering valid
# v3.23 versions instead of erroring, and this pin silently stops tracking.
RUN apk add --no-cache jq=1.8.2-r0

# dist/ carries no config.json: vite.config.ts sets build.copyPublicDir false so
# the development config never enters the image. A ConfigMap that fails to mount
# is therefore a hard failure, not a pod quietly serving localhost defaults.
COPY --from=build-qr-manager-ui /usr/src/app/ui/qr-manager-ui/dist /usr/share/nginx/html
COPY packages/nginx-runtime/conf.d/healthz.conf /etc/nginx/snippets/healthz.conf
COPY packages/nginx-runtime/docker-entrypoint.d/05-validate-runtime-config.sh /docker-entrypoint.d/
# Template is processed at container start by the nginx image's built-in
# envsubst entrypoint. Set NGINX_BASE_PATH env var in the deployment
# (e.g. /qr-manager or /) to configure the sub-path at runtime.
COPY ui/qr-manager-ui/nginx.conf.template /etc/nginx/templates/default.conf.template
RUN chmod +x /docker-entrypoint.d/05-validate-runtime-config.sh
USER 101
EXPOSE 8080
ENV NGINX_BASE_PATH=/
# ENTRYPOINT / CMD / STOPSIGNAL inherited from the base image — rule F4.

# ─── qr-manager-ui-config-validator ────────────────────────────────────────────
FROM deps AS build-qr-manager-ui-validator

RUN pnpm --filter=qr-manager-ui run build:validator

FROM node:24-alpine AS qr-manager-ui-config-validator

COPY --from=build-qr-manager-ui-validator \
     /usr/src/app/ui/qr-manager-ui/dist-validator/validate-config.js /app/validate-config.js
# Reads one file and exits — nothing here needs root.
#
# Numeric UID, NOT `node`. Kubernetes verifies runAsNonRoot against the image's
# configured user, and cannot map a username to a UID — that mapping lives in
# the image's /etc/passwd, which the kubelet does not read. With `USER node` it
# fails closed: CreateContainerConfigError "container has runAsNonRoot and image
# has non-numeric user (node), cannot verify user is non-root", and the pod never
# leaves Init. 1000 is the node user in node:*-alpine.
USER 1000
ENTRYPOINT ["node", "/app/validate-config.js"]
# Local-run convenience only. In-cluster the chart supplies the path as an arg,
# derived from templates.<name>.file — never hardcode a filename here.
CMD ["/config/config.json"]
