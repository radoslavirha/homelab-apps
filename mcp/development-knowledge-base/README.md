# development-knowledge-base

MCP server for the development knowledge base: search and read it from any MCP client (Claude Code, Claude on the web or phone, ChatGPT, Cursor, a CI agent). It answers from `knowledge-base-api`.

**Status: endpoint only.** The MCP endpoint answers at `/` (Streamable HTTP, stateless) but has no tools yet. The three read-only tools and the upstream client come next.

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

`config/localhost.json` (gitignored, local runs) and `config/test.json` (tests).

| Key | Description |
|-----|-------------|
| `server.httpPort` | Port to listen on |
| `health` | Health endpoint configuration (optional) |
| `logger` | Log level and options (optional) |
| `otel` | OpenTelemetry exporters (optional, all off locally) |

## Build and release

CI lints, builds and tests it and builds its image (`development-knowledge-base` stage of the root `Dockerfile`) on every change under this folder. It is **not released or deployed**: there is no `deploy.json` and no changeset until phase 2 adds the login.
