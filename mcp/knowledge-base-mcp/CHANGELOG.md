# knowledge-base

## 0.4.1

### Patch Changes

- [#402](https://github.com/radoslavirha/homelab-apps/pull/402) [`e108147`](https://github.com/radoslavirha/homelab-apps/commit/e108147df23ae2606812a2fdd711280f0aba81b1) Thanks [@radoslavirha](https://github.com/radoslavirha)! - `create_note`, `write_document` and `delete_document` are sent to knowledge-base-api once, never retried. A write that failed with a 5xx may already have committed, and its replay reported "already exists", "no longer exists" or "has changed" for a write that succeeded ([#392](https://github.com/radoslavirha/homelab-apps/issues/392)). The tool descriptions now say to read before retrying after a server error as well as after a timeout.
- Updated dependencies []:
  - @radoslavirha/tsed-http-provider@0.2.13
  - @radoslavirha/tsed-health@0.3.6

## 0.4.0

### Minor Changes

- [#399](https://github.com/radoslavirha/homelab-apps/pull/399) [`76028c3`](https://github.com/radoslavirha/homelab-apps/commit/76028c37b51235ae712c5fe4fccbd9a4349e3d04) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Renamed from `knowledge-base` to `knowledge-base-mcp` (folder, package, image `ghcr.io/radoslavirha/knowledge-base-mcp`). The `/development` endpoint's Authentik application is now `knowledge-base-mcp-development` and the shared login client `knowledge-base-mcp-clients`, so `auth.issuer`, `auth.audience` and `auth.roles` change with the deployment's config.

### Patch Changes

- [#366](https://github.com/radoslavirha/homelab-apps/pull/366) [`e2dbd20`](https://github.com/radoslavirha/homelab-apps/commit/e2dbd206d214bac1ae2cce11fc10288fa8a2c7d0) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - /health now reports `warn` while the knowledge-base-api circuit breaker is open.

- [#382](https://github.com/radoslavirha/homelab-apps/pull/382) [`44a0427`](https://github.com/radoslavirha/homelab-apps/commit/44a0427edd97d124853731ba98af7064214bf050) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A malformed `search` filter is reported to the agent as its own mistake (400) instead of a bad gateway.

- [#397](https://github.com/radoslavirha/homelab-apps/pull/397) [`98c1be3`](https://github.com/radoslavirha/homelab-apps/commit/98c1be31a88c54694ca2292c8b68b418733b871f) Thanks [@radoslavirha](https://github.com/radoslavirha)! - The write tools' descriptions say that after a timeout the write may have landed, so the agent reads the document before retrying.
- Updated dependencies []:
  - @radoslavirha/tsed-http-provider@0.2.12
  - @radoslavirha/tsed-health@0.3.5

## 0.3.0

### Minor Changes

- [#390](https://github.com/radoslavirha/homelab-apps/pull/390) [`3f4f829`](https://github.com/radoslavirha/homelab-apps/commit/3f4f829f795c31cc8100c78585c12f60a2fafa63) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Add the writing tools `create_note`, `write_document` and `delete_document` (editor level), each one commit made for the signed-in user through knowledge-base-api; `read` returns the document's `version`. Upstream client is now `knowledge-base-mcp`.

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
