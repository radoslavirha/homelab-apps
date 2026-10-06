# Instructions

- End-user documentation lives in [README.md](./README.md): runtime config keys and the server-side environment.
- Built on the same pattern as `ui/qr-manager-ui` (runtime config via `@radoslavirha/ui-runtime`, validator image, `NGINX_BASE_PATH`); differences are below.

## What it does

Reads static DNS records from the UniFi Network Application, groups them by server, and renders one tile per service. Deployed on `server3` as a single Application (no sandbox/production pair), unlike the `server1` apps.

## Source layout

- `src/lib/unifi.ts` — fetches static DNS records through the nginx proxy; `src/lib/parseDns.ts` groups them by the `serverPattern` capture group.
- `src/components/` — `ClusterSection`, `Tile`.
- `src/runtime/RuntimeConfig.ts` — Zod schema (`AppConfigSchema`); `validate-config.ts` bundles it into the `homelab-dashboard-ui-config-validator` image.
- `docker-entrypoint.d/10-require-unifi-env.sh` — refuses to start without `UNIFI_HOST` and `SECRET_UNIFI_API_KEY`.

## Rules

- `config.json` is public — it is served to the browser. Never add a credential, host or API key to it; server-side values are nginx env vars (`UNIFI_HOST`, `SECRET_UNIFI_API_KEY`), attached by `proxy_set_header`.
- `serverPattern` has no default on purpose: the domain suffix is a deployment fact, and omitting it must fail config validation.
- `nginx -T` prints the rendered config with the API key. Never paste its output into an issue, PR or log.
