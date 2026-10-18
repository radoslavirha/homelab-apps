# Instructions

- End-user documentation lives in [README.md](./README.md). Keep it up to date when adding tools, config keys or transports.
- The design and its phases live in the private knowledge base (`knowledge-base` skill): search it for `development-kb-mcp` before changing anything non-obvious.

## What it does

An MCP server in front of `knowledge-base-api`, so that any MCP client can search and read the development knowledge base. **Today it is an empty Ts.ED server**: health endpoints only, no MCP endpoint, no upstream.

## Rules

- **Phase 1 has no inbound login, and no switch either.** It runs on a laptop and is never deployed in this state. Inbound auth arrives later as a required config key with no way to turn it off — the repository rule in the root AGENTS.md § Authentication.
- **Never forward a caller's token upstream.** This server calls knowledge-base-api as its own client (`development-kb-mcp`), with a token it fetches itself.
- **Read-only.** The tools search and read; nothing writes to the knowledge base, which lives in git.
- **Built and tested in CI, not released.** It has its Dockerfile stages and paths-filter entry, but no `deploy.json` and no changeset until phase 2 gives it a login.
