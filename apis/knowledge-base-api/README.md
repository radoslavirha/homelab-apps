# knowledge-base-api

Indexes knowledge bases into Postgres — full-text (`tsvector`) and vectors (pgvector, one HNSW index per embedding model) — and serves hybrid search over an internal REST API. Sources are pluggable: each knowledge base names one, and the first is a git repository read through the GitHub API as a GitHub App. Chunking, embedding (Ollama) and search are shared by every source. A writable source (git) also takes writes — a note, a whole spec or plan, a delete — each one commit, checked against the version the caller last saw.

## Consumed By

- A person with a token, for now (port-forward; the service is ClusterIP only and never exposed)
- The knowledge-base MCP server, with its own client-credentials token: search, read, and the write routes on behalf of its user
- Later: a chat-UI retrieval filter, with its own Authentik client

## External Dependencies

| System | Protocol | Condition | Purpose |
|--------|----------|-----------|---------|
| Postgres (`knowledge_base` database, pgvector) | TCP 5432 | always — readiness depends on it | Index, search, migrations, the indexing lock |
| Ollama | HTTP `POST /api/embed` | knowledge bases with `models` | Embeds chunks while indexing and questions while searching. Unreachable → search answers full-text only |
| GitHub REST API (`api.github.com`) | HTTPS, as a GitHub App | `source: GIT` | Installation discovery, branch tip, compare, tree, blobs; the contents API (read, `PUT`, `DELETE` a file) for writes — needs *Contents: write* |
| Identity provider JWKS | HTTPS | always | Verifies bearer tokens |

## REST API

Every route but `/health*` and the API documentation (the Swagger landing page at `/` and the UI it links to) needs a bearer token with `knowledge-base-api.reader`; the write routes also need `knowledge-base-api.editor`, `POST /reindex` `knowledge-base-api.admin`. A caller sees only the knowledge bases whose `readers` list holds one of its roles; `kb` defaults to all of them.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search` | Search. Query: `q` (required), `kb` (comma-separated ids), `filter` (`key:value,…` on metadata — a repeated key means "or", different keys "and"; matches scalars and array members; values are strings, so a YAML `true` or `2` in frontmatter never matches), `limit` (1–50, default 10), `model` (answer with another configured model, to compare), `fullTextWeight` / `vectorWeight` (0–10, per-request RRF weights — to measure a blend). Returns `{ mode: VECTOR\|HYBRID\|FULLTEXT, models, results: [{ kb, externalId, anchor, title, heading, snippet, score, date, url, metadata }] }`. Abandoned specs (`status: abandoned`) and superseded notes (named in another document's `supersedes`) that make the `limit` are moved to the end, not dropped |
| GET | `/documents` | One whole document. Query: `id` (an `externalId` or a result's `anchor`), `kb`. `404` when no readable KB holds it, `409` when several do and `kb` is omitted |
| POST | `/notes` | A new `raw/` note, as fields — see *Writing*. Header `On-Behalf-Of: <username>`. Body: `kb`, `title` (one line), `type` (`DECISION`\|`CONTRACT`\|`GOTCHA`\|`NOTE`), `context`, `decisionOrFact`, `alternativesRejected[]` (required for a `DECISION`, refused otherwise), `howToApply?`, `links[]?`, `repos[]?`, `date?` (default today), `supersedes?` (must exist). `201 { id: raw/<date>-<slug>.md, version, commit }` |
| PUT | `/documents` | A whole `work/` spec or plan. Header `On-Behalf-Of`. Body: `kb`, `id` (`work/<date>-<slug>/spec.md`\|`plan.md`), `content` (frontmatter included), `version` (required to rewrite, absent to create), `message?` (commit body). `200 { id, version, commit }` |
| DELETE | `/documents` | A `raw/` note or a `work/` document. Header `On-Behalf-Of`. Body: `kb`, `id`, `version`, `reason`. `200 { id, commit }` |
| GET | `/status` | Per readable KB: cursor (git: indexed commit), last run (start, end, outcome, error), last success, document and chunk counts, documents per `area`, per model embedded and pending chunks; plus this pod's loop state |
| POST | `/reindex` | Starts a run. Query: `kb`, `full=true` (ignore the cursor and read everything — the recovery path). The only way to build a knowledge base for the first time or to embed a backlog above `indexer.maxScheduledEmbeddings`. Answers once it is known what happened: `202 { knowledgeBases, full, state: STARTED }` when this pod took the index lock; `202 { …, state: QUEUED }` when a run is in progress in this pod (this one follows it, merged with other queued requests); **`409`** when another pod holds the lock — nothing was started, try again when its run ends |

## Writing

`POST /notes`, `PUT /documents` and `DELETE /documents` write to the knowledge base's source, one commit per call — for git, one call to GitHub's contents API as the App; no clone, no branch. The caller is a service writing for a person: `On-Behalf-Of` names them (a username — letters, digits, `_ . @ + -`), and the commit says so:

```
kb: <note title | spec title | delete <id>>

<message, when given>

On-behalf-of: <username>
Via: knowledge-base MCP
Reason: <reason>            (deletes only)
```

| Area | Create | Rewrite | Delete |
|------|--------|---------|--------|
| `raw/` | `POST /notes` only — the API renders the file (`source: chat`, `author: <username>`), so the frontmatter cannot be malformed | never — append-only; supersede with a new note | yes |
| `work/` | `PUT` without `version`; a new folder is fine | `PUT` with `version` | yes |
| `mirror/`, anything else | never | never | never |

A `work/` document is checked as the knowledge base's note checker does: folder `work/YYYY-MM-DD-<kebab-slug>/` with a real date, file `spec.md` or `plan.md`, frontmatter `status` (`draft`\|`approved`\|`in-progress`\|`done`\|`abandoned`\|`reference`), `repos` (a list) and `created` (a date), and a `# ` title. **Anything that looks like a secret is refused**, in the content, the message or the reason: private keys, provider token formats, JWTs, a credential in a URL, a secret word with a value (`password: …` holding a digit), a `kv/…` path, and long high-entropy strings mixing cases and digits. Every rule breaks with `400` and says what to change, never the secret.

**`version` is the document's revision as the source checks it — for git, the file's blob SHA** — the same value `GET /documents` returns. A rewrite or delete sends it to GitHub as `sha`; GitHub refuses the commit when the file has another blob, and refuses a create of a file that exists. On a refusal the API reads the file on the branch and answers:

| Case | Answer |
|------|--------|
| The file's blob is not `version` | `409 { name: CONFLICT, message, status, errors: [{ name: CURRENT, message, content, version }] }` — the document as it is now |
| The blob is still `version` — the branch moved under the write | retried once; refused again → `409` with the document |
| The file is gone | `404` |
| A create, and the file exists | `409` with the document — a retried create whose first try landed sees its own content |

Apply the change to the `CURRENT` entry's `content` and write it with its `version`. (A create refused twice while the file does not exist is a plain `409`, no `CURRENT`.) The `version` a write answers is valid at once for the next write of that document.

Writes run one at a time in a pod (GitHub's contents API conflicts on parallel writes to one branch). After each one an **incremental indexing run is started** for that knowledge base, not awaited — the same run `POST /reindex` starts, under the same lock — so `GET /documents` and search see the write within seconds. A source that cannot be written answers `501`.

## Search

Two legs merged with weighted reciprocal rank fusion: full-text (the question's lexemes ORed, `ts_rank_cd`) and vector (cosine distance on the model's HNSW index). **Default weights are vector only** — in the model measurement vector alone beat plain RRF — and full-text answers whatever the vector leg cannot: a knowledge base without a model, chunks the model has no vector for yet (a deferred backlog, a failed batch — `mode: HYBRID`), or every knowledge base when the question cannot be embedded (`mode: FULLTEXT`). Measure a blend before configuring it:

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

**A run stops when the pod does.** On shutdown (a deploy) the run is aborted: the indexer stops between documents and embedding batches and cancels the GitHub or Ollama call in flight, so the pod drains inside its deadline. The same happens when the connection holding the index lock is lost. The knowledge base it was on records `INTERRUPTED` (not `FAILURE`, and no `job.run.items` either way); every step is idempotent, so the next run carries on — after a deploy during a first build, `POST /reindex` again.

Git documents get `metadata` from their frontmatter plus `area` (first path segment) and, under `mirror/<repo>/`, `repos: [<repo>]`; `date` from `date` or `created`; `version` the file's blob SHA; `url` at the indexed commit.

## Configuration

| Key | Description |
|-----|-------------|
| `database` | `host`, `port`, `database`, `user`, `password`, `sslMode` (`DISABLE`\|`REQUIRE`\|`VERIFY_FULL` + `caFile`), `pool`, `statementTimeoutMs` |
| `github` | `clientId`, `privateKey` (`{ source: value, value }` or `{ source: file, path }`, PEM as GitHub issues it), `baseUrl`, `timeoutMs` (per attempt: each retry gets its own; a rate-limit wait is not counted), `retries`. **No repository name** — it is discovered from the App's installation, which must cover exactly one repository |
| `embeddings.models[]` | `name` (Ollama tag), `dimensions`, `documentTemplate` (`{title}`, `{text}`), `queryTemplate` (`{query}`). Each model gets its own partial HNSW index at startup. Correcting a wrong `dimensions` before anything was embedded drops the old index; with vectors of the old size stored, the boot fails — a model's dimensions cannot change under one name, add a new entry |
| `embeddings` | `batchSize`, `keepAlive` (default `1m`) |
| `knowledgeBases[]` | `id`, `source` (`GIT`), `contentType` (`MARKDOWN`), `tsConfig` (Postgres text search configuration), `models` (first answers questions), `readers` (roles), `chunking` (`maxChars` default 3000, `overlapChars`), `git` (`branch`, `include` path prefixes, `extensions`) |
| `indexer` | `enabled`, `intervalMs`, `initialDelayMs`, `fetchConcurrency`, `maxScheduledEmbeddings` (default 300) |
| `search` | `defaultLimit`, `candidates` per leg, `rrfK`, `weights` (`fullText` default 0, `vector` default 1), `fullTextMatch` (`ANY` ORs the question's lexemes; `ALL` is `websearch_to_tsquery`) |
| `externalApis.OLLAMA` | Indexing: base URL, timeout, retry, circuit breaker. A batch of chunks on a CPU needs a long budget (60 s) |
| `externalApis.OLLAMA_SEARCH` | The same Ollama for a question at search time: a short timeout (5 s), no retry. Past it, search answers from full-text. A timeout does not trip the circuit breaker, so a slow Ollama costs every search this timeout |
| `auth.IDP` | Trusted issuers |
| `logger` | `@radoslavirha/tsed-logger` options: `level`, `requests.headers`, `requests.query`, `requests.ignorePaths`, … `requests.request` and `requests.response` are forced off in code — a value here is ignored |

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

Logs: one JSON line per request (`scope: HTTP_REQUEST`, `Request completed`, or `Request failed` at `error` for `≥ 400`) with `reqId`, `method`, `url`, `status`, `duration`, `query` (the question is in `q`) and the request headers, credential headers (`authorization`, `cookie`, `x-api-key`, …) redacted. **No request or response body** — a response is knowledge-base content, and one `GET /search` line used to carry every snippet. Every line written while a request is handled names the verified caller: `principalSubject` (the token's `sub`, e.g. `ak-development-kb-mcp-client_credentials`), `principalKind` and `principalIssuer`. A `403` line has them, a `401` line does not; no token or other claim is logged. Indexing runs log without a caller, `POST /reindex` ones and those a write starts included. A write logs `DOCUMENT_WRITTEN` (`knowledgeBase`, `id`, `commit`, `attempt`) or `DOCUMENT_WRITE_REFUSED` (`exists`), never the content.

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/live` | Liveness. Always `200` — no dependency I/O |
| GET | `/health/ready` | Readiness. `503` when Postgres is unreachable or the pod is draining |
| GET | `/health` | Full report: `{ status, checks }` |

Checks: `postgres` (**critical**, a `SELECT 1`), `upstream-apis` (non-critical: the Ollama circuit breaker; `warn` while open, readiness stays `200` because search still answers full-text). GitHub has no check — an unreachable GitHub only delays indexing, and `/status` shows the failed run.

## Shared Packages

`@radoslavirha/auth`, `@radoslavirha/tsed-auth`, `@radoslavirha/tsed-health`, `@radoslavirha/tsed-http-provider`, `@radoslavirha/otel`.
