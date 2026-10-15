import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DOCUMENT_CHANGE_VALUE_UNCHANGED, DOCUMENT_CHANGE_VALUE_UPSERT } from '../../otel/telemetry.js';
import { chunkDTO, documentDTO, seedDocument, truncateIndex } from '../../test/seed.js';
import { DocumentDTO } from './dto/DocumentDTO.js';
import { DocumentRepository } from './DocumentRepository.js';
import { PostgresService } from './PostgresService.js';

describe('DocumentRepository', () => {
    let documents: DocumentRepository;
    let postgres: PostgresService;

    const chunkIds = async (externalId: string): Promise<string[]> => (await postgres.query<{ id: string }>(
        'SELECT c.id FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.external_id = $1 ORDER BY c.ord',
        [externalId]
    )).rows.map((row) => row.id);

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        documents = PlatformTest.get<DocumentRepository>(DocumentRepository);
        postgres = PlatformTest.get<PostgresService>(PostgresService);
        await truncateIndex();
    });
    afterEach(PlatformTest.reset);

    describe('upsert', () => {
        it('writes a new document and its chunks, with full-text vectors in the KB\'s language', async () => {
            expect.assertions(3);

            const change = await documents.upsert(documentDTO('raw/a.md', { title: 'Probes' }), 'english', [chunkDTO(0, 'Fact', 'The kubelet probes Traefik')]);

            expect(change).toBe(DOCUMENT_CHANGE_VALUE_UPSERT);
            expect(await chunkIds('raw/a.md')).toHaveLength(1);
            // "probes" stems to "probe" in english; the title is in the vector too.
            expect((await postgres.query("SELECT 1 FROM chunks WHERE fts @@ to_tsquery('english', 'probe')")).rowCount).toBe(1);
        });

        it('only bumps the version when content, fields and chunks are unchanged — whatever the metadata key order', async () => {
            expect.assertions(3);

            const chunks = [chunkDTO(0, 'A', 'alpha')];

            await documents.upsert(documentDTO('raw/a.md', { metadata: { area: 'raw', type: 'gotcha' } }), 'english', chunks);
            const before = await chunkIds('raw/a.md');
            const change = await documents.upsert(documentDTO('raw/a.md', { version: 'c2', metadata: { type: 'gotcha', area: 'raw' } }), 'english', chunks);

            expect(change).toBe(DOCUMENT_CHANGE_VALUE_UNCHANGED);
            expect(await chunkIds('raw/a.md')).toEqual(before);
            expect((await postgres.query<{ version: string }>('SELECT version FROM documents')).rows).toEqual([{ version: 'c2' }]);
        });

        it('rewrites a document whose chunking changed even though its content did not', async () => {
            expect.assertions(1);

            await documents.upsert(documentDTO('raw/a.md'), 'english', [chunkDTO(0, 'A', 'alpha')]);

            expect(await documents.upsert(documentDTO('raw/a.md'), 'english', [chunkDTO(0, 'A', 'alpha'), chunkDTO(1, 'B', 'beta')]))
                .toBe(DOCUMENT_CHANGE_VALUE_UPSERT);
        });

        it('keeps the rows of chunks whose hash survived, adds new ones and deletes the rest', async () => {
            expect.assertions(4);

            const before = await seedDocument(documentDTO('raw/a.md'), [chunkDTO(0, 'A', 'alpha'), chunkDTO(1, 'B', 'beta'), chunkDTO(2, 'C', 'gamma')]);

            await documents.upsert(documentDTO('raw/a.md', { content: 'changed' }), 'english', [
                chunkDTO(0, 'C', 'gamma'),
                chunkDTO(1, 'D', 'delta'),
                chunkDTO(2, 'A', 'alpha')
            ]);
            const { rows } = await postgres.query<{ id: string; heading: string; ord: number }>(
                'SELECT c.id, c.heading, c.ord FROM chunks c ORDER BY c.ord'
            );

            expect(rows.map((row) => row.heading)).toEqual(['C', 'D', 'A']);
            expect(rows.find((row) => row.heading === 'A')?.id).toBe(before.A);
            expect(rows.find((row) => row.heading === 'C')?.id).toBe(before.C);
            expect(rows.some((row) => row.id === before.B)).toBe(false);
        });

        it('reuses each of two identical chunks once, not both on one row', async () => {
            expect.assertions(2);

            await documents.upsert(documentDTO('raw/a.md'), 'english', [chunkDTO(0, 'A', 'same', 'h'), chunkDTO(1, 'A', 'same', 'h')]);
            const before = await chunkIds('raw/a.md');

            await documents.upsert(documentDTO('raw/a.md', { content: 'changed' }), 'english', [chunkDTO(0, 'A', 'same', 'h'), chunkDTO(1, 'A', 'same', 'h')]);

            expect(await chunkIds('raw/a.md')).toEqual(before);
            expect(new Set(before).size).toBe(2);
        });
    });

    describe('delete', () => {
        it('removes the named documents and their chunks', async () => {
            expect.assertions(3);

            await seedDocument(documentDTO('raw/a.md'), [chunkDTO(0, 'A', 'alpha')]);
            await seedDocument(documentDTO('raw/b.md'), [chunkDTO(0, 'B', 'beta')]);

            expect(await documents.delete('dev', ['raw/a.md', 'raw/missing.md'])).toBe(1);
            expect(await chunkIds('raw/a.md')).toEqual([]);
            expect(await chunkIds('raw/b.md')).toHaveLength(1);
        });

        it('answers 0 for nothing to delete', async () => {
            expect.assertions(1);

            expect(await documents.delete('dev', [])).toBe(0);
        });

        it('keeps only the named documents on deleteAllExcept', async () => {
            expect.assertions(2);

            await seedDocument(documentDTO('raw/a.md'), [chunkDTO(0, 'A', 'alpha')]);
            await seedDocument(documentDTO('raw/b.md'), [chunkDTO(0, 'B', 'beta')]);

            expect(await documents.deleteAllExcept('dev', ['raw/b.md'])).toBe(1);
            expect((await postgres.query<{ external_id: string }>('SELECT external_id FROM documents')).rows).toEqual([{ external_id: 'raw/b.md' }]);
        });
    });

    describe('find', () => {
        it('reads a document back as a DTO, date as written', async () => {
            expect.assertions(2);

            await seedDocument(documentDTO('raw/a.md', { date: '2026-01-01', url: 'https://example.test/a', metadata: { area: 'raw', repos: ['x'] } }), []);

            const [found] = await documents.find(['dev'], 'raw/a.md');

            expect(found).toBeInstanceOf(DocumentDTO);
            expect(found).toEqual(expect.objectContaining({
                kb: 'dev',
                externalId: 'raw/a.md',
                date: '2026-01-01',
                url: 'https://example.test/a',
                metadata: { area: 'raw', repos: ['x'] }
            }));
        });

        it('looks only in the given knowledge bases', async () => {
            expect.assertions(1);

            await seedDocument(documentDTO('raw/a.md'), []);

            expect(await documents.find(['other'], 'raw/a.md')).toEqual([]);
        });
    });
});
