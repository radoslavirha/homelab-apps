# knowledge-base-api

Indexes knowledge bases into Postgres — full-text (`tsvector`) and vectors (pgvector, one HNSW index per embedding model) — and serves hybrid search over an internal REST API. Sources are pluggable: each knowledge base names one, and the first is a git repository read through the GitHub API as a GitHub App. Chunking, embedding (Ollama) and search are shared by every source.

## Consumed By

- A person with a token, for now (port-forward; the service is ClusterIP only and never exposed)
- Later: an MCP adapter and a chat-UI retrieval filter, each with its own Authentik client

## External Dependencies

| System | Protocol | Condition | Purpose |
|--------|----------|-----------|---------|
| Postgres (`knowledge_base` database, pgvector) | TCP 5432 | always — readiness depends on it | Index, search, migrations, the indexing lock |
| Ollama | HTTP `POST /api/embed` | knowledge bases with `models` | Embeds chunks while indexing and questions while searching. Unreachable → search answers full-text only |
| GitHub REST API (`api.github.com`) | HTTPS, as a GitHub App | `source: GIT` | Installation discovery, branch tip, compare, tree, blobs |
| Identity provider JWKS | HTTPS | always | Verifies bearer tokens |

## REST API

Every route but `/health*` needs a bearer token with `knowledge-base-api.reader`; `POST /reindex` also needs `knowledge-base-api.admin`. A caller sees only the knowledge bases whose `readers` list holds one of its roles; `kb` defaults to all of them.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search` | Search. Query: `q` (required), `kb` (comma-separated ids), `filter` (`key:value,…` on metadata — a repeated key means "or", different keys "and"; matches scalars and array members), `limit` (1–50, default 10), `model` (answer with another configured model, to compare), `fullTextWeight` / `vectorWeight` (0–10, per-request RRF weights — to measure a blend). Returns `{ mode: VECTOR\|HYBRID\|FULLTEXT, models, results: [{ kb, externalId, anchor, title, heading, snippet, score, date, url, metadata }] }`. Abandoned specs (`status: abandoned`) and superseded notes (named in another document's `supersedes`) rank last |
| GET | `/documents` | One whole document. Query: `id` (an `externalId` or a result's `anchor`), `kb`. `404` when no readable KB holds it, `409` when several do and `kb` is omitted |
| GET | `/status` | Per readable KB: cursor (git: indexed commit), last run (start, end, outcome, error), last success, document and chunk counts, documents per `area`, per model embedded and pending chunks; plus this pod's loop state |
| POST | `/reindex` | Starts a run now and answers `202`. Query: `kb`, `full=true` (ignore the cursor and read everything — the recovery path). The only way to build a knowledge base for the first time or to embed a backlog above `indexer.maxScheduledEmbeddings`. Queues behind a run already in progress in this pod |

## Search

Two legs merged with weighted reciprocal rank fusion: full-text (the question's lexemes ORed, `ts_rank_cd`) and vector (cosine distance on the model's HNSW index). **Default weights are vector only** — in the model measurement vector alone beat plain RRF — and full-text answers whatever the vector leg cannot: a knowledge base without a model, or every knowledge base when the question cannot be embedded (`mode: FULLTEXT`). Measure a blend before configuring it:

```bash
KB_API_URL=http://localhost:4003 KB_API_TOKEN=… node scripts/evaluate-search.mjs questions.json 0:1 0.25:1 0.5:1
```

## Indexing

```
every intervalMs (default 5 min), one pod at a time (Postgres advisory lock), incremental only:
  for each knowledge base:
    source.changes(cursor)            git: compare cursor…branch tip; full tree listing on the first
                                      run, a force-push, diverged history or ≥300 changed files
    chunk                             markdown: H2/H3 sections, heading path on each, split at
                                      paragraphs over maxChars (tables keep their header row);
                                      mirror/<repo>/_history.md: one chunk per H2 entry
    upsert documents + chunks         chunks reconciled by hash — unchanged text keeps its vectors
    copy vectors to identical chunks  a renamed file is not embedded again
    delete what is gone               complete snapshot: everything not in it
    store cursor
    embed chunks with no vector       per model, in batches; embedder down → stays pending
```

**First builds and big backlogs are started by hand** (`POST /reindex`): a full embed saturates the Ollama node for ~25 minutes and evicts its chat model. A scheduled run skips a knowledge base that was never indexed, and leaves a model's backlog above `indexer.maxScheduledEmbeddings` (300) pending — `/status` shows it. Requests pass a short `keep_alive` (1m) so a chat model gets its memory back.

Git documents get `metadata` from their frontmatter plus `area` (first path segment) and, under `mirror/<repo>/`, `repos: [<repo>]`; `date` from `date` or `created`; `url` at the indexed commit.

## Configuration

| Key | Description |
|-----|-------------|
| `database` | `host`, `port`, `database`, `user`, `password`, `sslMode` (`DISABLE`\|`REQUIRE`\|`VERIFY_FULL` + `caFile`), `pool`, `statementTimeoutMs` |
| `github` | `clientId`, `privateKey` (`{ source: value, value }` or `{ source: file, path }`, PEM as GitHub issues it), `baseUrl`, `timeoutMs`, `retries`. **No repository name** — it is discovered from the App's installation, which must cover exactly one repository |
| `embeddings.models[]` | `name` (Ollama tag), `dimensions`, `documentTemplate` (`{title}`, `{text}`), `queryTemplate` (`{query}`). Each model gets its own partial HNSW index at startup |
| `embeddings` | `batchSize`, `keepAlive` (default `1m`) |
| `knowledgeBases[]` | `id`, `source` (`GIT`), `contentType` (`MARKDOWN`), `tsConfig` (Postgres text search configuration), `models` (first answers questions), `readers` (roles), `chunking` (`maxChars` default 3000, `overlapChars`), `git` (`branch`, `include` path prefixes, `extensions`) |
| `indexer` | `enabled`, `intervalMs`, `initialDelayMs`, `fetchConcurrency`, `maxScheduledEmbeddings` (default 300) |
| `search` | `defaultLimit`, `candidates` per leg, `rrfK`, `weights` (`fullText` default 0, `vector` default 1), `fullTextMatch` (`ANY` ORs the question's lexemes; `ALL` is `websearch_to_tsquery`) |
| `externalApis.OLLAMA` | Base URL, timeout, retry, circuit breaker |
| `auth.IDP` | Trusted issuers |

A cross-field mistake (a KB naming an undeclared model, a git KB without `github`) fails the boot.

## Telemetry

| Metric | Attributes | Meaning |
|--------|------------|---------|
| `job.run.duration` / `job.run.items` / `job.run.skips` | `job.name=index_knowledge_bases` | One run; one item per knowledge base; `overrun` when another pod holds the lock |
| `knowledge_base.documents.indexed` | `knowledge_base.id`, `knowledge_base.document.change` (`upsert`\|`unchanged`\|`delete`) | Documents per run |
| `knowledge_base.chunks.embedded` | `knowledge_base.embedding.model`, `knowledge_base.embedding.outcome` | Chunks sent to the embedder |
| `knowledge_base.index.last_success` | `knowledge_base.id` | Unix seconds of the last successful run — `time() - x` is the index age |
| `knowledge_base.searches` | `knowledge_base.search.mode` (`vector`\|`hybrid`\|`fulltext`) | `fulltext` rising means the embedder is unreachable |

Spans: `index knowledge bases` (root) › `index knowledge base` › `embed chunks`; Postgres queries (`@opentelemetry/instrumentation-pg`, parameters never recorded) and GitHub calls (`@opentelemetry/instrumentation-undici`) underneath.

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/live` | Liveness. Always `200` — no dependency I/O |
| GET | `/health/ready` | Readiness. `503` when Postgres is unreachable or the pod is draining |
| GET | `/health` | Full report: `{ status, checks }` |

Checks: `postgres` (**critical**, a `SELECT 1`), `upstream-apis` (non-critical: the Ollama circuit breaker; `warn` while open, readiness stays `200` because search still answers full-text). GitHub has no check — an unreachable GitHub only delays indexing, and `/status` shows the failed run.

## Shared Packages

`@radoslavirha/auth`, `@radoslavirha/tsed-auth`, `@radoslavirha/tsed-health`, `@radoslavirha/tsed-http-provider`, `@radoslavirha/otel`.
