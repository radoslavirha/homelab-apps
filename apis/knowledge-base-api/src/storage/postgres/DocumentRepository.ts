import { Serializer } from '@radoslavirha/tsed-common';
import { ArrayUtils, CommonUtils, ObjectUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import type pg from 'pg';
import {
    DOCUMENT_CHANGE_VALUE_UNCHANGED,
    DOCUMENT_CHANGE_VALUE_UPSERT,
    type DocumentChange
} from '../../otel/telemetry.js';
import type { ChunkDTO } from './dto/ChunkDTO.js';
import { DocumentDTO } from './dto/DocumentDTO.js';
import { PostgresService } from './PostgresService.js';
import { ftsExpression } from './sql.js';

const DOCUMENT_COLUMNS = 'd.kb, d.external_id, d.title, d.date::text AS date, d.url, d.content, d.version, d.metadata';

@Service()
@Scope(ProviderScope.SINGLETON)
export class DocumentRepository {
    public constructor(private readonly postgres: PostgresService) {}

    /**
     * Writes one document and its chunks in one transaction.
     *
     * A document whose fields and chunk hashes are all unchanged only gets its `version` and
     * `url` bumped — a full rebuild is mostly that. The url is not compared: a source may derive
     * it from the revision it read (a git permalink names the commit, not the file's blob), so it changes whenever that does. Otherwise the chunks are reconciled by hash: a
     * chunk whose hash survives keeps its row, so its embeddings survive with it, and only new
     * or changed text is embedded again.
     */
    public upsert(document: DocumentDTO, tsConfig: string, chunks: readonly ChunkDTO[]): Promise<DocumentChange> {
        return this.postgres.transaction(async (client) => {
            const { rows: existing } = await client.query<{ id: string; hashes: string[] }>(
                `SELECT d.id, ${DOCUMENT_COLUMNS},
                        coalesce((SELECT array_agg(c.hash ORDER BY c.ord) FROM chunks c WHERE c.document_id = d.id), '{}') AS hashes
                 FROM documents d WHERE d.kb = $1 AND d.external_id = $2
                 FOR UPDATE`,
                [document.kb, document.externalId]
            );
            const [row] = existing;

            if (CommonUtils.notUndefined(row)) {
                const stored = Serializer.deserialize(row, DocumentDTO);

                if (sameDocument(stored, document) && sameHashes(row.hashes, chunks)) {
                    await client.query('UPDATE documents SET version = $2, url = $3 WHERE id = $1', [row.id, document.version, document.url]);

                    return DOCUMENT_CHANGE_VALUE_UNCHANGED;
                }
            }

            const { rows } = await client.query<{ id: string }>(
                `INSERT INTO documents (kb, external_id, title, date, url, content, version, metadata)
                 VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8::jsonb)
                 ON CONFLICT (kb, external_id) DO UPDATE SET
                     title = EXCLUDED.title, date = EXCLUDED.date, url = EXCLUDED.url, content = EXCLUDED.content,
                     version = EXCLUDED.version, metadata = EXCLUDED.metadata
                 RETURNING id`,
                [
                    document.kb, document.externalId, document.title, document.date, document.url,
                    document.content, document.version, JSON.stringify(document.metadata)
                ]
            );

            await this.reconcileChunks(client, rows[0].id, tsConfig, document.title, chunks);

            return DOCUMENT_CHANGE_VALUE_UPSERT;
        });
    }

    /** Deletes the named documents; chunks and embeddings go with them. Returns how many. */
    public async delete(kb: string, externalIds: readonly string[]): Promise<number> {
        if (CommonUtils.isEmpty(externalIds)) {
            return 0;
        }

        const result = await this.postgres.query(
            'DELETE FROM documents WHERE kb = $1 AND external_id = ANY($2::text[])',
            [kb, externalIds]
        );

        return result.rowCount ?? 0;
    }

    /** Deletes every document of the KB not named in `keep`. Returns how many. */
    public async deleteAllExcept(kb: string, keep: readonly string[]): Promise<number> {
        const result = await this.postgres.query(
            'DELETE FROM documents WHERE kb = $1 AND NOT (external_id = ANY($2::text[]))',
            [kb, keep]
        );

        return result.rowCount ?? 0;
    }

    /** The document with this id in any of the given KBs — more than one when ids collide. */
    public async find(kbs: readonly string[], externalId: string): Promise<DocumentDTO[]> {
        const { rows } = await this.postgres.query(
            `SELECT ${DOCUMENT_COLUMNS} FROM documents d WHERE d.kb = ANY($1::text[]) AND d.external_id = $2 ORDER BY d.kb`,
            [kbs, externalId]
        );

        return Serializer.deserializeArray(rows, DocumentDTO);
    }

    private async reconcileChunks(
        client: pg.PoolClient,
        documentId: string,
        tsConfig: string,
        title: string | null,
        chunks: readonly ChunkDTO[]
    ): Promise<void> {
        const { rows: old } = await client.query<{ id: string; hash: string }>(
            'SELECT id, hash FROM chunks WHERE document_id = $1 ORDER BY ord',
            [documentId]
        );
        const reusable = new Map<string, string[]>();

        for (const row of old) {
            reusable.set(row.hash, [...(reusable.get(row.hash) ?? []), row.id]);
        }

        const kept = new Set<string>();
        const fts = ftsExpression('$6::regconfig', '$7', '$2', '$4');

        for (const chunk of chunks) {
            const reuse = reusable.get(chunk.hash)?.shift();

            if (CommonUtils.isUndefined(reuse)) {
                await client.query(
                    `INSERT INTO chunks (document_id, ord, heading, anchor, body, hash, fts)
                     VALUES ($8, $1, $2, $3, $4, $5, ${fts})`,
                    [chunk.ord, chunk.heading, chunk.anchor, chunk.body, chunk.hash, tsConfig, title, documentId]
                );
            } else {
                kept.add(reuse);
                await client.query(
                    `UPDATE chunks SET ord = $1, heading = $2, anchor = $3, body = $4, hash = $5, fts = ${fts}
                     WHERE id = $8`,
                    [chunk.ord, chunk.heading, chunk.anchor, chunk.body, chunk.hash, tsConfig, title, reuse]
                );
            }
        }

        const stale = old.map((row) => row.id).filter((id) => !kept.has(id));

        if (!CommonUtils.isEmpty(stale)) {
            await client.query('DELETE FROM chunks WHERE id = ANY($1::bigint[])', [stale]);
        }
    }
}

const sameDocument = (stored: DocumentDTO, incoming: DocumentDTO): boolean =>
    stored.title === incoming.title &&
    stored.date === incoming.date &&
    stored.content === incoming.content &&
    stableJson(stored.metadata) === stableJson(incoming.metadata);

const sameHashes = (stored: readonly string[], chunks: readonly ChunkDTO[]): boolean =>
    stored.length === chunks.length && chunks.every((chunk, index) => chunk.hash === stored[index]);

/** JSON with object keys sorted — `jsonb` hands keys back in its own order. */
const stableJson = (value: unknown): string => JSON.stringify(value, (_key, inner: unknown) =>
    ObjectUtils.isPlainObject(inner) && !ArrayUtils.isArray(inner)
        ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
        : inner);
