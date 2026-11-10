# knowledge-base-mcp

MCP server for the knowledge bases in `knowledge-base-api`: search, read and write them from any MCP client (Claude Code, Claude on the web or phone, ChatGPT, Cursor, a CI agent). One app, one MCP endpoint per audience — today the development and the Loxone knowledge bases.

**Status: phase 2 — login; deployed to production on server1.** Two MCP endpoints (Streamable HTTP, stateless), `/development` serving the `development` knowledge base and `/loxone` serving `loxone`, with the same two reading and three writing tools, answered from knowledge-base-api; every write is one commit to the knowledge base's git source, made for the signed-in user. Production's endpoints require a sign-in through Authentik (OAuth 2.1, the MCP authorization spec). An endpoint is its knowledge base: the one it serves is set in config, and a caller never names one. The app mounts one endpoint per entry in `mcpServers`; a knowledge base with another audience is one more entry.

## Run it

```bash
pnpm --filter ./mcp/knowledge-base-mcp start     # NODE_ENV=localhost, config/localhost.json
```

Listens on port `4004`.

| Method | Path | |
|--------|------|---|
| POST | `/development`, `/loxone` | An MCP endpoint: Streamable HTTP, JSON responses, no sessions. Negotiates protocol `2025-11-25` and the earlier versions through `initialize`. Requires `Authorization: Bearer <token>` — see *Sign-in* |
| GET | `/.well-known/oauth-protected-resource/development`, `…/loxone` | The endpoint's Protected Resource Metadata (RFC 9728): its resource identifier, Authentik as the authorization server, the scopes to ask for |
| GET, DELETE | `/development`, `/loxone` | `405` — a stateless endpoint has no event stream to open and no session to end |
| GET | `/health/live` | Liveness. Always `200` |
| GET | `/health/ready` | Readiness. `503` while the process drains |
| GET | `/health` | Full report: `{ status, checks }` (`application/health+json`); `upstream-apis` is `warn` while the knowledge-base-api circuit breaker is open (never gates readiness) |

Point an MCP client at `http://localhost:4004/development` or `/loxone` (the transport is HTTP, there is no stdio mode); it signs you in through Authentik on first use. Deployed, the public URL adds the route prefix: `…/kb/development`, `…/kb/loxone`. To try it by hand: the MCP Inspector (`npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", URL `http://localhost:4004/development`), or any HTTP client posting JSON-RPC with `Content-Type: application/json` and `Accept: application/json, text/event-stream`.

## Sign-in

Each endpoint is an OAuth resource server. A request without a valid token gets `401` with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/<path>", scope="openid profile email roles"`; the client reads the metadata, finds Authentik, signs the user in (PKCE) and calls again with the token.

| Answer | When |
|--------|------|
| `401` `invalid_token` | No token, or one from another issuer, for another audience, expired, or badly signed. The reason is logged (`MCP_AUTH_REFUSED`), never sent. The request log records this `401` at `info`, not `error`: every new client starts with one |
| `403` `insufficient_scope` | A good token holding none of the endpoint's roles. Signing in again cannot help; the refusal names no role |
| `500` `server_error` | Authentik's signing keys could not be fetched — the token may be fine |

The token is checked by `@radoslavirha/auth` (issuer, audience, signature, expiry), as in the APIs, then for one of the endpoint's roles. It never leaves this server: tools call knowledge-base-api with the server's own token (*Upstream token*).

Each tool then requires its own level: `search`, `read` and `conventions` need `READER` (`knowledge-base-mcp-<endpoint>.reader`, e.g. `knowledge-base-mcp-development.reader`); `create_note`, `write_document` and `delete_document` need `EDITOR` (`knowledge-base-mcp-<endpoint>.editor`, whose holders Authentik also gives the reader role). Each endpoint checks its own roles and audience: a token for one is refused on the other. A caller is shown only the tools of the levels it holds: a reader's `tools/list` has the three reading tools, an editor's all six. A caller that calls a tool it was not shown gets the JSON-RPC error `Tool <name> not found` (`-32602`), the same as for a tool that does not exist, and the API is not called.

Claude Code uses a pre-registered client with a fixed callback port:

```bash
claude mcp add --transport http --scope user --client-id <client_id> --callback-port 33418 development-kb http://localhost:4004/development
claude mcp add --transport http --scope user --client-id <client_id> --callback-port 33418 loxone-kb http://localhost:4004/loxone
```

## Tools

All work on the endpoint's own knowledge base; none takes a `kb` (an extra `kb` argument is ignored). `tools/list` lists a tool only to a caller holding its level (*Sign-in*). A failure comes back as a tool result with `isError`, carrying the message.

| Tool | Level | Input | Returns |
|------|-------|-------|---------|
| `search` | `READER` | `query`; optional `filter` (`key:value,…` on metadata), `limit` (1–50; the endpoint's `search.defaultLimit` when absent, lowered to its `search.maxLimit` — by default 8 and 50) | `hits[]`, best first: `id`, `anchor`, `title`, `heading`, `snippet`, `date` |
| `read` | `READER` | `id` (from a hit) | `id`, `title`, `date`, `metadata`, `version`, `markdown` — the whole document. An unknown id says to search first |
| `conventions` | `READER` | none | `path` (e.g. `README.md`; `null` when none), `markdown` — the knowledge base's own house rules (areas, naming, frontmatter), read live from its source by knowledge-base-api. Empty `markdown` when the knowledge base publishes none |
| `create_note` | `EDITOR` | `title`, `type` (`DECISION`, `CONTRACT`, `GOTCHA`, `NOTE`), `context`, `decisionOrFact`; optional `alternativesRejected[]` (required for a `DECISION`), `howToApply`, `links[]`, `repos[]`, `date`, `supersedes` | `id` (`raw/<date>-<slug>.md`), `version`, `commit` |
| `write_document` | `EDITOR` | `id` (`work/<date>-<slug>/spec.md` or `plan.md`), `content` (the whole markdown, starting with frontmatter: `status` one of `draft`, `approved`, `in-progress`, `done`, `abandoned`, `reference`; `repos` a list; `created` `YYYY-MM-DD`), `version` (to rewrite; absent to create), optional `message` | `id`, `version`, `commit` |
| `delete_document` | `EDITOR` | `id` (a `raw/` note or a `work/` document), `version`, `reason` | `id`, `commit` |

`search`, `read` and `conventions` are read-only (`readOnlyHint`). The writing tools are not, and `delete_document` is destructive (`destructiveHint`), so clients that confirm such tools ask the user first. None is open-world.

**Conventions.** Every endpoint sends MCP server `instructions` in its `initialize` result, which clients that support them hand to their agent: by default, to search first, to call `conventions` before writing or preparing files for a manual commit, and to get the user's yes on every write. `conventions` is how an agent facing an empty knowledge base learns what to produce; it describes, the API's write checks still decide. A knowledge base publishes conventions by naming the file in knowledge-base-api's `knowledgeBases[].conventionsPath`.

**Writes.** knowledge-base-api renders and validates every write, refuses anything that looks like a secret, and makes one commit through its GitHub App or token; this server holds no key to the repository. The user a write is for is the caller's verified token's `sub` (their Authentik username), sent as `On-Behalf-Of` — never a tool argument. `version` is opaque: pass the newest one held — from `read`, or the one the last write of that document returned.

| Answer | When |
|--------|------|
| `isError`, `status_code: 409`, `current: { content, version }` | The document changed since `version`, or a note or document being created already exists. Apply the change to `current.content`, show the user again, retry with `current.version` |
| `isError` with the API's message | `400` (a field breaks the format, a secret, a path the tool cannot write), `404` (the document is gone), `501` (the knowledge base's source cannot be written), or a `409` without the current document |

## Configuration

Every key with its type, default and meaning: [CONFIGURATION.md](./CONFIGURATION.md), generated from the configuration schema.

`config/localhost.json` (gitignored, local runs) and `config/test.json` (tests). Before a local run, put `knowledge-base-mcp`'s client secret into `externalApis.KNOWLEDGE_BASE_API.auth.request.body.client_secret` in `config/localhost.json` — it is read from the client's Authentik provider page and never committed. `config/localhost.json` mounts whichever `mcpServers` entries it has; at least one is required.

| Key | Description |
|-----|-------------|
| `server.httpPort` | Port to listen on |
| `publicURL` | Required. Public base URL: scheme, host and route prefix, no endpoint path — `http://localhost:4004` locally, `https://mcp.irha.cz/kb` deployed. An endpoint's resource identifier (and the audience clients ask Authentik for) is this plus its `path` |
| `mcpServers[]` | A list, one entry per MCP endpoint the app mounts, as many as configured (production: `development-kb`, `loxone-kb`). Each entry: `path` (in the app; the public route adds its prefix, `/kb`, and Traefik strips it), `kb` (the knowledge base it serves, its id in knowledge-base-api, e.g. `development`, `loxone`), `name`, `title`, optional `description` (what clients are told the endpoint holds; defaults to the package's), optional `instructions` (the MCP server instructions clients hand their agent; defaults to the generic `DEFAULT_INSTRUCTIONS` in `src/mcp/toMcpSettings.ts`), and `auth`. `name` also identifies the endpoint in logs, refusals and auth, so names must differ. At least one entry is required. Paths must differ, ignoring case |
| `mcpServers[].auth` | Required. `type` (default `oauth`), then for `oauth`: `issuer` (the shared client registration's Authentik issuer, advertised as the authorization server and the only `iss` accepted), `audience` (the endpoint's Authentik application for this environment), `key` (`{ source: jwks, uri: <issuer>jwks/ }`; an inline HS256 key in tests), `roles` (the endpoint's Authentik role per level: `READER` → `knowledge-base-mcp-<endpoint>.reader`, `EDITOR` → `knowledge-base-mcp-<endpoint>.editor`), `scopes` (default `openid profile email roles`; must include `profile` and `roles`) |
| `mcpServers[].search` | Optional. How the endpoint searches; never a `search` tool argument. `defaultLimit` (default `8`): hits when the agent gives no `limit`. `maxLimit` (default and at most `50`, the API's cap): a larger `limit` is lowered to it. `defaultLimit` above `maxLimit` fails at boot. `model`: the embedding model for the vector leg (unset: the knowledge base's first configured model; it must be one of that knowledge base's models in knowledge-base-api). `weights.vector` (default `1`) and `weights.fullText` (default `0`), 0–10, at least one above 0: the RRF weights, sent on every search, so they override knowledge-base-api's configured `search.weights`. The defaults are this server's own constants, matching the API's |
| `externalApis.KNOWLEDGE_BASE_API` | knowledge-base-api: `baseURL` (from a laptop, the LAN route `https://api.server1.homelab.irha.cz/kb/knowledge-base`), resilience, and `auth` — `token-exchange` with a `client_credentials` request for `knowledge-base-mcp` (which holds `knowledge-base-api.editor`) to Authentik's token endpoint, form-encoded, scope `openid profile email roles` (without `profile`, `aud` is the bare client id and the API refuses the token) |
| `health` | Health endpoint configuration (optional) |
| `logger` | Log level and options (optional). `requests.request` and `requests.response` are forced off in code — a value here is ignored: a tool call's arguments are whole documents and may hold a secret |
| `otel` | OpenTelemetry exporters (optional, all off locally) |

### Adding an endpoint

One endpoint per knowledge base, sharing the tools. Config only — no code change, no release:

1. Add a `mcpServers` entry to the deployment's values under a new `UPPER_SNAKE_CASE` key: its own `path`, `kb`, `name`, `title`, `description` and `auth`. Say what the knowledge base covers in `description`, because the tools' own text is generic. Set `instructions` only to say more than the default does.
2. Give it an Authentik application with `reader` and `editor` roles, and add that application to the `accesses` of the shared client registration.

The route and the metadata rewrite cover every path under `/kb`. Removing an endpoint is removing its entry.

### Trying search settings

The `search` block makes a search experiment config only. To compare an embedding model or a full-text blend against the current endpoint, add a second entry on the same `kb` under its own `path` (e.g. `/development-qwen`) with a different `search`, point a client at it, and compare the answers; then copy the winner into the main entry, or remove the experiment. A changed `search` takes effect on restart. A second endpoint also needs its own Authentik application and roles (step 2 above).

## Upstream token

The server calls knowledge-base-api as itself, never with a caller's token. http-provider's `token-exchange` caches the token until the API answers `401` — the token expired after its 10 minutes — then fetches a new one and retries that call once. No refresh code of its own: one refused call per token lifetime, and only while the server is in use.

`resilience.retry` applies to `search` and `read` only. A write is sent once: one that failed may still have committed, and a replay would report `409`/`404` for a write that succeeded. After a timeout or a `5xx` the agent reads before trying again.

## Build and release

CI lints, builds and tests it and builds its image (`knowledge-base-mcp` stage of the root `Dockerfile`) on every change under this folder. A release deploys it to **production** on server1 (`deploy.json` → homelab `values-production.yaml`), at `https://mcp.irha.cz/kb/development` and `https://mcp.irha.cz/kb/loxone` — Traefik strips `/kb`, and rewrites the Protected Resource Metadata path `/.well-known/oauth-protected-resource/kb/…` to the app's own. Production only: the knowledge bases exist nowhere else.
