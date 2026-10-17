# Instructions

- API end-user documentation lives in [README.md](./README.md). Keep it up to date when adding or changing endpoints, config keys, or sources — the `updating-docs` skill owns its format. Swagger UI is mounted at `/`.

## What it does

Keeps a searchable index of one or more knowledge bases in Postgres (full-text + pgvector) and serves hybrid search over an internal REST API. Two jobs in one process: a background **indexing loop** that pulls changes from each knowledge base's source, chunks, embeds (Ollama) and stores them; and the **REST API** (`/search`, `/documents`, `/status`, `/reindex`). It is the only holder of the database login — callers (an MCP adapter, a chat filter) go through its API, never the database.

## Source layout beyond the root conventions

- `sources/` — the pluggable seam. `SourceAdapter` reports what changed since a cursor (`upserts`, `deletes`, `cursor`, `complete`); everything after it is source-neutral. `SourceAdapterFactory` maps `knowledgeBases[].source` to an adapter. `sources/git/` is the one implementation: the GitHub API as a GitHub App, through Octokit.
- `migrations/` — numbered schema migrations, run by node-pg-migrate at startup. TypeScript so swc compiles them into `dist/`; a `.sql` file would not reach the image.
- `storage/postgres/` — the pool (`PostgresService`), `SchemaMigrator` (migrations + the config-driven part: one HNSW index per model, one row per KB), and the repositories. Rows are deserialized into the DTO classes under `dto/` (`@Name` maps the snake_case columns).
- `endpoints/github/` — Octokit, but the contract is the repo's: every Octokit response is deserialized into a DTO under `dto/`; the git adapter filters and decodes.
- `services/MarkdownChunkerService.ts`, `FrontmatterService.ts`, `RankFusionService.ts` — pure logic. `markdown/` holds the per-document helpers the chunker uses (`FenceTracker`, `GithubSlugger`): stateful, so plain classes rather than providers.
- `scripts/evaluate-search.mjs` — top-5 and MRR of a running instance for given weight blends; the question set lives with the knowledge base, not here.
- `test/` — the pgvector testcontainer (`globalSetup.ts`), a database per test file (`setupDatabase.ts`) — so even unit specs on `PlatformTest.create` get a migrated schema — the test doubles (`FakeOllamaEndpoint`, `FakeSourceAdapter`, `FakeSourceAdapterFactory`, one per file), helpers (`fakes.ts`) and a corpus. Excluded from the build.

## Rules

- **Never configure a repository name.** The git source discovers it from the App's installation (exactly one repository, or it refuses). This repo and the deployment values are public.
- **Indexing and search embed through `EmbeddingService` only**, so a chunk and a question are always shaped by the same model template. A template change changes every vector: add a new model entry instead of editing one.
- **Search degrades, it does not fail**, when the question cannot be embedded: `mode: FULLTEXT`. Readiness depends on Postgres only (`postgres` is the one critical health check).
- **Default weights are vector only, because that is what was measured.** Change `search.weights` only after measuring the blend with `scripts/evaluate-search.mjs` against the real question set.
- **Scheduled runs are incremental only.** A first build and a backlog above `indexer.maxScheduledEmbeddings` need `POST /reindex`: a full embed takes the Ollama node for ~25 minutes and evicts its chat model.
- **Order in an indexing run is load-bearing**: documents, then deletions, then the cursor, then embeddings. A crash repeats the run from the old cursor; the embedder being down leaves chunks pending, never fails the run.
- **One indexer across pods**: the run holds a Postgres advisory lock; a pod that finds it taken skips (`job.run.skips{job.skip.reason=overrun}`), and `POST /reindex` on that pod answers `409` rather than a `202` for a run that never happens.
- **A run is abortable, and must stay so.** `$onDestroy` and a lost lock connection abort it; the indexer checks the signal between documents and batches and hands it to every GitHub and Ollama call. A new step in a run takes the signal too, or a deploy mid-run ends in the hard shutdown deadline. An aborted run records `INTERRUPTED`, not `FAILURE`.
- One trust domain (`AuthMethod.Idp`) on every controller class, `knowledge-base-api.reader` as the class-level floor, `knowledge-base-api.admin` added on `POST /reindex`. Which knowledge bases a caller sees is each KB's `readers` list; an unreadable KB answers the same `404` as a missing one.
- Mappers are one-directional (storage → response): no endpoint writes documents.
