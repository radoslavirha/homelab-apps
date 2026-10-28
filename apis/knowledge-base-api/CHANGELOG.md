# knowledge-base-api

## 0.3.0

### Minor Changes

- [#385](https://github.com/radoslavirha/homelab-apps/pull/385) [`115f9ae`](https://github.com/radoslavirha/homelab-apps/commit/115f9ae88af48374bea52c3c1b838dfe46475891) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Write routes: `POST /notes` (a `raw/` note rendered from fields), `PUT /documents` (a whole `work/` spec or plan) and `DELETE /documents`, each one commit through GitHub's contents API as the App, for the user named in the `On-Behalf-Of` header. They need the new `knowledge-base-api.editor` role, enforce the knowledge base's area, format and naming rules, refuse anything that looks like a secret, run one at a time, answer a stale `version` with `409` and the document as it is now (the `CURRENT` entry of `errors`), and start an incremental indexing run. A document's `version` is now the file's blob SHA instead of the indexed commit. **After deploying, run `POST /reindex?full=true` once** so every stored version becomes a blob SHA (unchanged documents are not embedded again).

### Patch Changes

- [#386](https://github.com/radoslavirha/homelab-apps/pull/386) [`290de7a`](https://github.com/radoslavirha/homelab-apps/commit/290de7ab8c488a6e84bb16d9b51adfe1928f799e) Thanks [@radoslavirha](https://github.com/radoslavirha)! - OpenAPI examples name the knowledge base `development` instead of `dev`, the id it is deployed under from now on.
- Updated dependencies []:
  - @radoslavirha/tsed-http-provider@0.2.11

## 0.2.3

### Patch Changes

- [#326](https://github.com/radoslavirha/homelab-apps/pull/326) [`7c286b3`](https://github.com/radoslavirha/homelab-apps/commit/7c286b3d174f12200420ea3a4151f7166338a60d) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A failed file read during indexing now stops the other fetch workers instead of leaving them reading the rest of the tree.
- Updated dependencies []:
  - @radoslavirha/tsed-health@0.3.4

## 0.2.2

### Patch Changes

- [#338](https://github.com/radoslavirha/homelab-apps/pull/338) [`0accb0e`](https://github.com/radoslavirha/homelab-apps/commit/0accb0ec2d569606d179772fa0ae8b0a297cb4ad) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Ship the previous release's changes. That release was tagged, but its run failed before any image was built (`mcp/knowledge-base` had no `deploy.json`), so it was never deployed.

## 0.2.1

### Patch Changes

- [`099d0cd`](https://github.com/radoslavirha/homelab-apps/commit/099d0cd52cbb08f3bc850569b2fd5e6ab9b31f4b) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update packages

- [`cdc8602`](https://github.com/radoslavirha/homelab-apps/commit/cdc8602df9612f207fabfc1821f1890239a34722) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Request log lines name the verified caller (`principalSubject`, `principalKind`, `principalIssuer`) and no longer carry request or response bodies — a `GET /search` line used to hold every result snippet.
- Updated dependencies [[`20c61e5`](https://github.com/radoslavirha/homelab-apps/commit/20c61e558621cba57a2b2ae95d902d44ac35baab), [`099d0cd`](https://github.com/radoslavirha/homelab-apps/commit/099d0cd52cbb08f3bc850569b2fd5e6ab9b31f4b)]:
  - @radoslavirha/auth@0.3.0
  - @radoslavirha/otel@0.6.5
  - @radoslavirha/tsed-auth@0.3.1
  - @radoslavirha/tsed-health@0.3.3
  - @radoslavirha/tsed-http-provider@0.2.10

## 0.2.0

### Minor Changes

- [#320](https://github.com/radoslavirha/homelab-apps/pull/320) [`34f3075`](https://github.com/radoslavirha/homelab-apps/commit/34f3075349d88db083c4a541dd7b130c64831fef) Thanks [@radoslavirha](https://github.com/radoslavirha)! - An indexing run now stops when the pod shuts down (or loses the connection holding its lock) instead of running into the drain deadline; the knowledge base records `INTERRUPTED`. `POST /reindex` answers once it knows what happened: `202` with `state: STARTED` or `QUEUED` (replacing the `queued` flag), or `409` when another pod holds the index lock. `github.timeoutMs` now bounds each attempt rather than the whole call, a model's index left under a corrected `dimensions` is dropped at startup, and a test pins the vector query to its HNSW index.

## 0.1.1

### Patch Changes

- Updated dependencies [[`d5b67cb`](https://github.com/radoslavirha/homelab-apps/commit/d5b67cb7293177913233282fcac87de11563b933), [`d5b67cb`](https://github.com/radoslavirha/homelab-apps/commit/d5b67cb7293177913233282fcac87de11563b933), [`d5b67cb`](https://github.com/radoslavirha/homelab-apps/commit/d5b67cb7293177913233282fcac87de11563b933), [`6bd3255`](https://github.com/radoslavirha/homelab-apps/commit/6bd32558bf2a34f2e3160a799d2618c3961853b5)]:
  - @radoslavirha/auth@0.2.2
  - @radoslavirha/tsed-auth@0.3.0
  - @radoslavirha/tsed-http-provider@0.2.9
