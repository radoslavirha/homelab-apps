import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * The source-neutral layout: nothing here assumes git. What is specific to a source lives in
 * `documents.metadata`, its position in `knowledge_bases.cursor` and `documents.version`, and
 * the full-text language in `knowledge_bases.ts_config` — which is why `chunks.fts` is written
 * by the indexer rather than generated from a fixed configuration.
 *
 * `CREATE EXTENSION vector` is not here: the extension is declared on the database by its
 * operator, and this service's role cannot create it.
 *
 * The per-model HNSW indexes are not here either: they follow configuration, so `SchemaService`
 * creates them at startup.
 */
export const up = (pgm: MigrationBuilder): void => {
    pgm.sql(`
CREATE TABLE knowledge_bases (
    id                   text PRIMARY KEY,
    source               text NOT NULL,
    ts_config            regconfig NOT NULL,
    cursor               text,
    last_run_started_at  timestamptz,
    last_run_finished_at timestamptz,
    last_run_outcome     text,
    last_run_error       text,
    last_success_at      timestamptz
);

CREATE TABLE documents (
    id          bigserial PRIMARY KEY,
    kb          text NOT NULL REFERENCES knowledge_bases ON DELETE CASCADE,
    external_id text NOT NULL,
    title       text,
    date        date,
    url         text,
    content     text NOT NULL,
    version     text NOT NULL,
    metadata    jsonb NOT NULL DEFAULT '{}',
    UNIQUE (kb, external_id)
);
CREATE INDEX documents_metadata_idx ON documents USING gin (metadata);

CREATE TABLE chunks (
    id          bigserial PRIMARY KEY,
    document_id bigint NOT NULL REFERENCES documents ON DELETE CASCADE,
    ord         int NOT NULL,
    heading     text NOT NULL,
    anchor      text NOT NULL,
    body        text NOT NULL,
    hash        text NOT NULL,
    fts         tsvector NOT NULL
);
CREATE INDEX chunks_document_id_idx ON chunks (document_id);
CREATE INDEX chunks_hash_idx ON chunks (hash);
CREATE INDEX chunks_fts_idx ON chunks USING gin (fts);

CREATE TABLE embeddings (
    chunk_id  bigint NOT NULL REFERENCES chunks ON DELETE CASCADE,
    model     text NOT NULL,
    embedding vector NOT NULL,
    PRIMARY KEY (chunk_id, model)
);
CREATE INDEX embeddings_model_idx ON embeddings (model);
`);
};

/** The index is derived from its sources, so dropping it loses nothing a rebuild cannot restore. */
export const down = (pgm: MigrationBuilder): void => {
    pgm.sql('DROP TABLE embeddings, chunks, documents, knowledge_bases');
};
