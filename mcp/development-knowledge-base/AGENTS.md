# Instructions

- End-user documentation lives in [README.md](./README.md). Keep it up to date when adding tools, config keys or transports.
- The design and its phases live in the private knowledge base (`knowledge-base` skill): search it for `development-kb-mcp` before changing anything non-obvious.

## What it does

An MCP server in front of `knowledge-base-api`, so that any MCP client can search and read the development knowledge base. **Today:** the MCP endpoint at `/` (via `@tsed/platform-mcp`, stateless Streamable HTTP; configured in `src/index.ts` from `ConfigService`) and the shared health endpoints; `KnowledgeBaseApiEndpoint` calls knowledge-base-api; no tools yet.

## Rules

- **`@modelcontextprotocol/server` stays a direct dependency** (from the workspace catalog). `@tsed/platform-mcp` accepts any `>=2.0.0`, and pnpm resolved it to 2.0.0, which the transport (`@modelcontextprotocol/node`, needing `^2.3.0`) cannot load. The direct dependency keeps one copy at a version that works.

- **Phase 1 has no inbound login, and no switch either.** It runs on a laptop and is never deployed in this state. Inbound auth arrives later as a required config key with no way to turn it off — the repository rule in the root AGENTS.md § Authentication.
- **Never forward a caller's token upstream.** This server calls knowledge-base-api as its own client (`development-kb-mcp`), with a token it fetches itself.
- **No token refresh code.** http-provider's `token-exchange` re-fetches on `401` and retries once; `KnowledgeBaseApiEndpoint.integration.spec.ts` pins that flow against a fake Authentik and API. An expiry-aware cache, if the one refused call per token lifetime becomes noise, belongs in http-provider, not here.
- **Read-only.** The tools search and read; nothing writes to the knowledge base, which lives in git.
- **Built and tested in CI, not released.** It has its Dockerfile stages and paths-filter entry, but no `deploy.json` and no changeset until phase 2 gives it a login.
