# development-knowledge-base

MCP server for the development knowledge base: search and read it from any MCP client (Claude Code, Claude on the web or phone, ChatGPT, Cursor, a CI agent). It answers from `knowledge-base-api`.

**Status: endpoint and upstream client.** The MCP endpoint answers at `/` (Streamable HTTP, stateless) but has no tools yet. The client to knowledge-base-api is wired; the three read-only tools come next.

## Run it

```bash
pnpm --filter ./mcp/development-knowledge-base start     # NODE_ENV=localhost, config/localhost.json
```

Listens on port `4004`.

| Method | Path | |
|--------|------|---|
| POST | `/` | The MCP endpoint: Streamable HTTP, JSON responses, no sessions. Negotiates protocol `2025-11-25` and the earlier versions through `initialize` |
| GET, DELETE | `/` | `405` — a stateless endpoint has no event stream to open and no session to end |
| GET | `/health/live` | Liveness. Always `200` |
| GET | `/health/ready` | Readiness. `503` while the process drains |
| GET | `/health` | Full report: `{ status, checks }` (`application/health+json`) |

Point an MCP client at `http://localhost:4004/` (the transport is HTTP, there is no stdio mode).

## Configuration

`config/localhost.json` (gitignored, local runs) and `config/test.json` (tests). Before a local run, put `development-kb-mcp`'s client secret into `externalApis.KNOWLEDGE_BASE_API.auth.request.body.client_secret` in `config/localhost.json` — it is read from the client's Authentik provider page and never committed.

| Key | Description |
|-----|-------------|
| `server.httpPort` | Port to listen on |
| `externalApis.KNOWLEDGE_BASE_API` | knowledge-base-api: `baseURL` (from a laptop, the LAN route `https://api.server1.homelab.irha.cz/kb/knowledge-base`), resilience, and `auth` — `token-exchange` with a `client_credentials` request for `development-kb-mcp` to Authentik's token endpoint, form-encoded, scope `openid profile email roles` (without `profile`, `aud` is the bare client id and the API refuses the token) |
| `health` | Health endpoint configuration (optional) |
| `logger` | Log level and options (optional) |
| `otel` | OpenTelemetry exporters (optional, all off locally) |

## Upstream token

The server calls knowledge-base-api as itself, never with a caller's token. http-provider's `token-exchange` caches the token until the API answers `401` — the token expired after its 10 minutes — then fetches a new one and retries that call once. No refresh code of its own: one refused call per token lifetime, and only while the server is in use.

## Build and release

CI lints, builds and tests it and builds its image (`development-knowledge-base` stage of the root `Dockerfile`) on every change under this folder. It is **not released or deployed**: there is no `deploy.json` and no changeset until phase 2 adds the login.
