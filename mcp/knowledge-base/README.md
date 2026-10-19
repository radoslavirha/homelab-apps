# knowledge-base

MCP server for the knowledge bases in `knowledge-base-api`: search and read them from any MCP client (Claude Code, Claude on the web or phone, ChatGPT, Cursor, a CI agent). One app, one MCP endpoint per audience — today the development knowledge base.

**Status: phase 1 — local, no login.** One MCP endpoint, `/development` (Streamable HTTP, stateless), with three read-only tools answered from knowledge-base-api. The app can mount several endpoints — one per entry in `mcpServers` — for knowledge bases with other audiences later.

## Run it

```bash
pnpm --filter ./mcp/knowledge-base start     # NODE_ENV=localhost, config/localhost.json
```

Listens on port `4004`.

| Method | Path | |
|--------|------|---|
| POST | `/development` | The MCP endpoint: Streamable HTTP, JSON responses, no sessions. Negotiates protocol `2025-11-25` and the earlier versions through `initialize` |
| GET, DELETE | `/development` | `405` — a stateless endpoint has no event stream to open and no session to end |
| GET | `/health/live` | Liveness. Always `200` |
| GET | `/health/ready` | Readiness. `503` while the process drains |
| GET | `/health` | Full report: `{ status, checks }` (`application/health+json`) |

Point an MCP client at `http://localhost:4004/development` (the transport is HTTP, there is no stdio mode). Deployed, the public URL adds the route prefix: `…/kb/development`. To try it by hand: the MCP Inspector (`npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", URL `http://localhost:4004/development`), or any HTTP client posting JSON-RPC with `Content-Type: application/json` and `Accept: application/json, text/event-stream`.

## Tools

All three are read-only (`readOnlyHint`). A failure comes back as a tool result with `isError`, carrying the message.

| Tool | Input | Returns |
|------|-------|---------|
| `list_knowledge_bases` | — | `knowledgeBases[]`: `id`, `description` (from config), `documents`, `lastIndexedAt` |
| `search` | `query`; optional `kb`, `filter` (`key:value,…` on metadata), `limit` (1–20, default 8) | `hits[]`, best first: `kb`, `id`, `anchor`, `title`, `heading`, `snippet`, `date` |
| `read` | `kb`, `id` (from a hit) | `kb`, `id`, `title`, `date`, `metadata`, `markdown` — the whole document. An unknown id says to search first |

## Configuration

`config/localhost.json` (gitignored, local runs) and `config/test.json` (tests). Before a local run, put `development-kb-mcp`'s client secret into `externalApis.KNOWLEDGE_BASE_API.auth.request.body.client_secret` in `config/localhost.json` — it is read from the client's Authentik provider page and never committed.

| Key | Description |
|-----|-------------|
| `server.httpPort` | Port to listen on |
| `mcpServers.<McpServer>` | One entry per MCP endpoint the app mounts (`DEVELOPMENT_KB` today): `path` (in the app; the public route adds its prefix, `/kb`, and Traefik strips it), `name`, `title`, optional `description` (defaults to the package's). Every key is required and paths must differ |
| `knowledgeBases.<id>.description` | What a knowledge base holds, as `list_knowledge_bases` shows it. A knowledge base without one is listed with `description: null` |
| `externalApis.KNOWLEDGE_BASE_API` | knowledge-base-api: `baseURL` (from a laptop, the LAN route `https://api.server1.homelab.irha.cz/kb/knowledge-base`), resilience, and `auth` — `token-exchange` with a `client_credentials` request for `development-kb-mcp` to Authentik's token endpoint, form-encoded, scope `openid profile email roles` (without `profile`, `aud` is the bare client id and the API refuses the token) |
| `health` | Health endpoint configuration (optional) |
| `logger` | Log level and options (optional) |
| `otel` | OpenTelemetry exporters (optional, all off locally) |

## Upstream token

The server calls knowledge-base-api as itself, never with a caller's token. http-provider's `token-exchange` caches the token until the API answers `401` — the token expired after its 10 minutes — then fetches a new one and retries that call once. No refresh code of its own: one refused call per token lifetime, and only while the server is in use.

## Build and release

CI lints, builds and tests it and builds its image (`knowledge-base` stage of the root `Dockerfile`) on every change under this folder. It is **not released or deployed**: there is no `deploy.json` and no changeset until phase 2 adds the login.
