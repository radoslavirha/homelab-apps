# knowledge-base

## 0.2.1

### Patch Changes

- [#360](https://github.com/radoslavirha/homelab-apps/pull/360) [`99a42f3`](https://github.com/radoslavirha/homelab-apps/commit/99a42f3602ed508ddb45bfc72b475e6b8421bdf8) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - Tool calls on an MCP endpoint URL typed in another case (e.g. /Development) now reach the endpoint instead of failing; config paths differing only in case are refused at boot.
- Updated dependencies []:
  - @radoslavirha/tsed-http-provider@0.2.11

## 0.2.0

### Minor Changes

- [#343](https://github.com/radoslavirha/homelab-apps/pull/343) [`a78b9d8`](https://github.com/radoslavirha/homelab-apps/commit/a78b9d819f5ee53a09e6d48d5d7729798f301253) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Sign-in through Authentik: every MCP endpoint is an OAuth resource server with a required `auth` block, and each tool declares the least role it needs. An endpoint is its knowledge base — `search` and `read` no longer take `kb`, and `list_knowledge_bases` is gone. First release deployed to production (`mcp.irha.cz/kb/development`).

### Patch Changes

- Updated dependencies []:
  - @radoslavirha/tsed-health@0.3.4

## 0.1.1

### Patch Changes

- Updated dependencies [[`099d0cd`](https://github.com/radoslavirha/homelab-apps/commit/099d0cd52cbb08f3bc850569b2fd5e6ab9b31f4b)]:
  - @radoslavirha/otel@0.6.5
  - @radoslavirha/tsed-health@0.3.3
  - @radoslavirha/tsed-http-provider@0.2.10
