# Instructions

- End-user documentation lives in [README.md](./README.md). Keep it up to date when adding tools, config keys or transports.
- The design and its phases live in the private knowledge base (`knowledge-base` skill): search it for `development-kb-mcp` before changing anything non-obvious.

## What it does

An MCP server in front of `knowledge-base-api`, so that any MCP client can search and read its knowledge bases — one endpoint per audience, not one app per knowledge base. **Today:** one MCP endpoint, `/development` (via `@tsed/platform-mcp`, stateless Streamable HTTP; built in `src/index.ts` from `ConfigService` by `toMcpSettings`) and the shared health endpoints, with two read-only tools (`src/tools/`, `search` and `read`) answered from knowledge-base-api through `KnowledgeBaseApiEndpoint`.

## Rules

- **An MCP endpoint is a `McpServer` value plus a `mcpServers` entry**, the same contract as `ExternalApi` and `externalApis`: path, `kb`, name, title and description in config, and later its own `auth`. `path` is the app's own (`/development`); Traefik adds and strips the public prefix `/kb`. Endpoints share the tools in `src/tools/` — platform-mcp registers tool names globally, so two endpoints cannot each have their own `search`.

- **An endpoint is its knowledge base; a caller never names one.** No tool takes a `kb`: handlers ask `McpEndpointService.knowledgeBase()`, which matches the request path against `mcpServers` and returns that entry's `kb`. Without it knowledge-base-api's `/search` would search every knowledge base the client may read. A new audience (a household or a personal knowledge base) is a new endpoint in config, never a parameter; one whose knowledge base depends on the caller resolves it from the verified token in that service.
- **A tool is a class in `src/tools/`, exported from `src/tools/index.ts`.** `index.ts` registers every class that barrel exports, as `Server.ts` mounts controllers; there is no list to keep. Tool → handler → endpoint and mapper, like controller → handler in the APIs. The tool's `@Description` is what an agent reads to decide whether to call it: write it for that reader.
- **An output string that may be empty takes `@MinLength(0)`.** `@Required()` alone adds `minLength: 1`, and the SDK then rejects the whole result when real data has an empty value (a section before the first heading). `@Allow('')` is not the fix: it leaves `minLength: undefined`, which platform-mcp fails to convert at startup.
- **A tool's output model never has a top-level `content` property.** platform-mcp passes any result with a `content` key through as a finished MCP result, so the structured content the output schema promises goes missing and clients reject the call. `read` returns the document as `markdown` for that reason.

- **`@modelcontextprotocol/server` stays a direct dependency** (from the workspace catalog). `@tsed/platform-mcp` accepts any `>=2.0.0`, and pnpm resolved it to 2.0.0, which the transport (`@modelcontextprotocol/node`, needing `^2.3.0`) cannot load. The direct dependency keeps one copy at a version that works.

- **Phase 1 has no inbound login, and no switch either.** It runs on a laptop and is never deployed in this state. Inbound auth arrives later as a required config key with no way to turn it off — the repository rule in the root AGENTS.md § Authentication.
- **No public URL in the endpoint config.** Phase 1 needs none. Phase 2's `auth.resource` (platform-mcp requires the canonical public URL and never reads `Host`) is `api.publicURL` + the endpoint's `path` — e.g. `https://mcp.irha.cz/kb` + `/development` — not a per-endpoint key.
- **Never forward a caller's token upstream.** This server calls knowledge-base-api as its own client (`development-kb-mcp`), with a token it fetches itself.
- **No token refresh code.** http-provider's `token-exchange` re-fetches on `401` and retries once; `KnowledgeBaseApiEndpoint.integration.spec.ts` pins that flow against a fake Authentik and API. An expiry-aware cache, if the one refused call per token lifetime becomes noise, belongs in http-provider, not here.
- **Read-only.** The tools search and read; nothing writes to the knowledge base, which lives in git.
- **Built and tested in CI, released but not deployed.** It has its Dockerfile stages and paths-filter entry, and `deploy.json` is `{}`: the release workflow fails any released app without a `deploy.json`, and a bump of a workspace dependency versions this app too. With `{}` a release publishes the image and the deploy action skips every environment. Environments go into `deploy.json` in the homelab phase, after phase 2 gives it a login. No changeset of its own until then.
