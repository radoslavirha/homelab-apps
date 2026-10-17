---
"knowledge-base-api": minor
---

An indexing run now stops when the pod shuts down (or loses the connection holding its lock) instead of running into the drain deadline; the knowledge base records `INTERRUPTED`. `POST /reindex` answers once it knows what happened: `202` with `state: STARTED` or `QUEUED` (replacing the `queued` flag), or `409` when another pod holds the index lock. `github.timeoutMs` now bounds each attempt rather than the whole call, a model's index left under a corrected `dimensions` is dropped at startup, and a test pins the vector query to its HNSW index.
