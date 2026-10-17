# knowledge-base-api

## 0.2.0

### Minor Changes

- [#320](https://github.com/radoslavirha/homelab-apps/pull/320) [`34f3075`](https://github.com/radoslavirha/homelab-apps/commit/34f3075349d88db083c4a541dd7b130c64831fef) Thanks [@radoslavirha](https://github.com/radoslavirha)! - An indexing run now stops when the pod shuts down (or loses the connection holding its lock) instead of running into the drain deadline; the knowledge base records `INTERRUPTED`. `POST /reindex` answers once it knows what happened: `202` with `state: STARTED` or `QUEUED` (replacing the `queued` flag), or `409` when another pod holds the index lock. `github.timeoutMs` now bounds each attempt rather than the whole call, a model's index left under a corrected `dimensions` is dropped at startup, and a test pins the vector query to its HNSW index.

## 0.1.1

### Patch Changes

- Updated dependencies [[`d5b67cb`](https://github.com/radoslavirha/homelab-apps/commit/d5b67cb7293177913233282fcac87de11563b933), [`d5b67cb`](https://github.com/radoslavirha/homelab-apps/commit/d5b67cb7293177913233282fcac87de11563b933), [`d5b67cb`](https://github.com/radoslavirha/homelab-apps/commit/d5b67cb7293177913233282fcac87de11563b933), [`6bd3255`](https://github.com/radoslavirha/homelab-apps/commit/6bd32558bf2a34f2e3160a799d2618c3961853b5)]:
  - @radoslavirha/auth@0.2.2
  - @radoslavirha/tsed-auth@0.3.0
  - @radoslavirha/tsed-http-provider@0.2.9
