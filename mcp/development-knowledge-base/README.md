# development-knowledge-base

MCP server for the development knowledge base: search and read it from any MCP client (Claude Code, Claude on the web or phone, ChatGPT, Cursor, a CI agent). It answers from `knowledge-base-api`.

**Status: scaffold.** A running Ts.ED server with the shared health endpoints and nothing else. The MCP endpoint, the three read-only tools and the upstream client come next.

## Run it

```bash
pnpm --filter ./mcp/development-knowledge-base start     # NODE_ENV=localhost, config/localhost.json
```

Listens on port `4004`.

| Method | Path | |
|--------|------|---|
| GET | `/health/live` | Liveness. Always `200` |
| GET | `/health/ready` | Readiness. `503` while the process drains |
| GET | `/health` | Full report: `{ status, checks }` (`application/health+json`) |

## Configuration

`config/localhost.json` (gitignored, local runs) and `config/test.json` (tests).

| Key | Description |
|-----|-------------|
| `server.httpPort` | Port to listen on |
| `health` | Health endpoint configuration (optional) |
| `logger` | Log level and options (optional) |
| `otel` | OpenTelemetry exporters (optional, all off locally) |

## Not wired yet

- **No CI paths-filter entry.** `.github/paths-filter-apps.yaml` also drives the image build, which needs a Dockerfile stage this server does not have yet. Until then CI checks it only through the whole-workspace verify that a change to `pnpm-workspace.yaml` or the lockfile triggers.
- No Dockerfile stage, no `deploy.json`, no changeset: it is not built as an image, released or deployed.
