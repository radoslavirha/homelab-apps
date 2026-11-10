# knowledge-base

## 0.10.0

### Minor Changes

- [#448](https://github.com/radoslavirha/homelab-apps/pull/448) [`96471fd`](https://github.com/radoslavirha/homelab-apps/commit/96471fde91d5ba77f14a63e91929d062cd3cc3a4) Thanks [@radoslavirha](https://github.com/radoslavirha)! - **Breaking config change:** `mcpServers` is now a list of endpoints instead of a map keyed by `UPPER_SNAKE_CASE` names. Each entry's `name` identifies the endpoint in logs, refusals and auth, and must be unique, like `path`. The old map shape is refused at boot, so the homelab values must switch to the list in the same deploy.

### Patch Changes

- [#446](https://github.com/radoslavirha/homelab-apps/pull/446) [`3b5d95e`](https://github.com/radoslavirha/homelab-apps/commit/3b5d95e48cb28f2073110a76052932fd42febe84) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Ship `CONFIGURATION.md`, a configuration reference generated from the config schema and pinned by a test, and update dependencies: the latest toolkit-hub packages (`@radoslavirha/tsed-configuration` 0.10.0, `@radoslavirha/utils` 0.11.0, `@radoslavirha/tsed-logger` 0.7.11 and patch releases), Ts.ED 8.46, mongoose 9.12 and other patch/minor releases.

- [#449](https://github.com/radoslavirha/homelab-apps/pull/449) [`3539f97`](https://github.com/radoslavirha/homelab-apps/commit/3539f9729aa84585a240da181eb847619123d9c1) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Upgrade OpenTelemetry JS to 3.x (SDK 3.1, experimental 0.301): `@opentelemetry/sdk-trace` replaces `sdk-trace-node`, and resources now also carry `os.*` and `service.instance.id`.

- [#449](https://github.com/radoslavirha/homelab-apps/pull/449) [`3539f97`](https://github.com/radoslavirha/homelab-apps/commit/3539f9729aa84585a240da181eb847619123d9c1) Thanks [@radoslavirha](https://github.com/radoslavirha)! - New `otel.resourceAttributes` config key: extra resource attributes (string, number or boolean) on every span, metric and log record. `service.name` and `service.version` stay app-owned and are rejected.
- Updated dependencies [[`3b5d95e`](https://github.com/radoslavirha/homelab-apps/commit/3b5d95e48cb28f2073110a76052932fd42febe84), [`3539f97`](https://github.com/radoslavirha/homelab-apps/commit/3539f9729aa84585a240da181eb847619123d9c1), [`3539f97`](https://github.com/radoslavirha/homelab-apps/commit/3539f9729aa84585a240da181eb847619123d9c1)]:
  - @radoslavirha/auth@0.4.1
  - @radoslavirha/tsed-http-provider@0.2.15
  - @radoslavirha/otel@0.7.0
  - @radoslavirha/tsed-health@0.3.7

## 0.9.0

### Minor Changes

- [#444](https://github.com/radoslavirha/homelab-apps/pull/444) [`72e2860`](https://github.com/radoslavirha/homelab-apps/commit/72e2860b51938592d2fc4321de6ada646531f36a) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Search settings per endpoint: an optional `mcpServers.<KEY>.search` block sets the default and maximum `limit`, the embedding model and the RRF weights sent to knowledge-base-api, so a model or a blend can be tried through config and a restart. The `search` tool's `limit` now accepts up to 50, lowered to the endpoint's `maxLimit` (default 50).

## 0.8.0

### Minor Changes

- [#441](https://github.com/radoslavirha/homelab-apps/pull/441) [`2f75807`](https://github.com/radoslavirha/homelab-apps/commit/2f758077dd6cf5d0f80421708d6c5aa3de55519e) Thanks [@radoslavirha](https://github.com/radoslavirha)! - `tools/list` shows a caller only the tools its roles allow: a reader sees `search`, `read` and `conventions`, an editor all six. A hidden tool called anyway answers `Tool <name> not found`; the per-tool role check stays.

### Patch Changes

- [#442](https://github.com/radoslavirha/homelab-apps/pull/442) [`418555e`](https://github.com/radoslavirha/homelab-apps/commit/418555eca8bdf0cd019821fb3d904d0d2e5f07f0) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Log a `401` carrying a `WWW-Authenticate` challenge at `info`, so the login discovery every new MCP client makes no longer counts as an error.

## 0.7.0

### Minor Changes

- [#433](https://github.com/radoslavirha/homelab-apps/pull/433) [`d963d9c`](https://github.com/radoslavirha/homelab-apps/commit/d963d9c9f054bea2673ff29127576b65077ca31f) Thanks [@radoslavirha](https://github.com/radoslavirha)! - New read-only `conventions` tool returns the knowledge base's own rules, and every endpoint sends MCP server `instructions` (new optional `mcpServers.<KEY>.instructions`, with a generic default) telling agents to call it before writing or preparing files. `write_document` now spells out the frontmatter it requires, including the allowed `status` values.

- [#436](https://github.com/radoslavirha/homelab-apps/pull/436) [`279f41d`](https://github.com/radoslavirha/homelab-apps/commit/279f41d237e0d190a16e4daf9013ae151b958daa) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Endpoints choose their auth type with `mcpServers.<key>.auth.type`; `oauth` stays the default, so existing configs parse unchanged.

### Patch Changes

- Updated dependencies [[`0c4b327`](https://github.com/radoslavirha/homelab-apps/commit/0c4b3276fcf804b8f90ec09616c66d326dc10410)]:
  - @radoslavirha/auth@0.4.0

## 0.6.0

### Minor Changes

- [#430](https://github.com/radoslavirha/homelab-apps/pull/430) [`70bdcd6`](https://github.com/radoslavirha/homelab-apps/commit/70bdcd612002ed6763de427bc748d3a95e0d1fef) Thanks [@radoslavirha](https://github.com/radoslavirha)! - MCP endpoints come from config alone: `mcpServers` takes any number of `UPPER_SNAKE_CASE` keys (at least one), and the fixed `McpServer` enum is gone.

## 0.5.0

### Minor Changes

- [#426](https://github.com/radoslavirha/homelab-apps/pull/426) [`ad19d7e`](https://github.com/radoslavirha/homelab-apps/commit/ad19d7e942418238d06e5d1a8182974f98c9409f) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Add the `LOXONE_KB` endpoint, serving a second knowledge base with the same tools. The config now requires a `mcpServers.LOXONE_KB` entry.

## 0.4.2

### Patch Changes

- [#405](https://github.com/radoslavirha/homelab-apps/pull/405) [`a9ed347`](https://github.com/radoslavirha/homelab-apps/commit/a9ed347bebcfad93ac160c7a881c4f72022187d4) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - The request log no longer writes tool-call arguments (documents, and any secret the API refuses) at info.

- [#409](https://github.com/radoslavirha/homelab-apps/pull/409) [`3f1536c`](https://github.com/radoslavirha/homelab-apps/commit/3f1536c9e215d704e9db82ed1f9e5b485ca28d8f) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A refusal of the server's own client by the token endpoint is no longer reported to the agent as its own bad input.

- [#418](https://github.com/radoslavirha/homelab-apps/pull/418) [`9b284cd`](https://github.com/radoslavirha/homelab-apps/commit/9b284cda876b89ff4485fa4cd5901be851e61dfe) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Tool descriptions no longer assume the homelab repositories, since every endpoint shares them. A test now runs two endpoints in one app.
- Updated dependencies [[`7b3d6bb`](https://github.com/radoslavirha/homelab-apps/commit/7b3d6bb2d9895c4dd7136b6391fb51f588b39247)]:
  - @radoslavirha/tsed-http-provider@0.2.14

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
