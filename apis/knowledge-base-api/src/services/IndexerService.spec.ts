import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaEndpoint } from '../endpoints/ollama/OllamaEndpoint.js';
import { ChunkingMode } from '../models/ChunkingMode.enum.js';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { SourceAdapterFactory } from '../sources/SourceAdapterFactory.js';
import { EmbeddingRepository } from '../storage/postgres/EmbeddingRepository.js';
import { KnowledgeBaseRepository } from '../storage/postgres/KnowledgeBaseRepository.js';
import { PostgresService } from '../storage/postgres/PostgresService.js';
import { FakeOllamaEndpoint } from '../test/FakeOllamaEndpoint.js';
import { FakeSourceAdapterFactory } from '../test/FakeSourceAdapterFactory.js';
import { sourceDocument } from '../test/fakes.js';
import { ConfigService } from './ConfigService.js';
import { IndexerService } from './IndexerService.js';

const NOTE = `---
date: 2026-01-01
type: gotcha
---
# ConfigMap envFrom changes don't restart pods

## Fact

A pod keeps the environment it booted with.

## How to apply

Check the pod age before blaming the sync.
`;

/** Started by hand: no limit on the embedding backlog. */
const MANUAL = { full: false, manual: true };

/**
 * The pipeline against a real database, with the source and the embedder replaced: what reaches
 * the database and the embedder for each kind of change a source can report.
 */
describe('IndexerService', () => {
    let indexer: IndexerService;
    let postgres: PostgresService;
    let ollama: FakeOllamaEndpoint;
    let sources: FakeSourceAdapterFactory;
    let dev: KnowledgeBaseConfig;

    const count = async (sql: string): Promise<number> => Number((await postgres.query<{ n: string }>(sql)).rows[0].n);
    const chunkIds = async (externalId: string): Promise<Record<string, string>> => {
        const { rows } = await postgres.query<{ heading: string; id: string }>(
            'SELECT c.heading, c.id FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.external_id = $1',
            [externalId]
        );

        return Object.fromEntries(rows.map((row) => [row.heading, row.id]));
    };

    beforeEach(async () => {
        ollama = new FakeOllamaEndpoint();
        sources = new FakeSourceAdapterFactory();

        await PlatformTest.create({
            imports: [
                { token: OllamaEndpoint, use: ollama },
                { token: SourceAdapterFactory, use: sources }
            ]
        });

        indexer = PlatformTest.get<IndexerService>(IndexerService);
        postgres = PlatformTest.get<PostgresService>(PostgresService);
        [dev] = PlatformTest.get<ConfigService>(ConfigService).config.knowledgeBases;
        await postgres.query('TRUNCATE documents CASCADE');
        await postgres.query("UPDATE knowledge_bases SET cursor = NULL WHERE id = 'development'");
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('indexes a first snapshot: documents, chunks, vectors and the cursor', async () => {
        expect.assertions(5);

        sources.adapter.next = { upserts: [sourceDocument('raw/note.md', NOTE, { title: 'Pods keep their env' })], deletes: [], cursor: 'c1', complete: true };

        const result = await indexer.index(dev, MANUAL);

        expect(result).toMatchObject({ cursor: 'c1', complete: true, upserted: 1, unchanged: 0, deleted: 0, embedded: { 'test-embed:v1': 2 } });
        expect(await count('SELECT count(*) AS n FROM chunks')).toBe(2);
        expect(await count("SELECT count(*) AS n FROM embeddings WHERE model = 'test-embed:v1'")).toBe(2);
        expect(await count("SELECT count(*) AS n FROM knowledge_bases WHERE id = 'development' AND cursor = 'c1'")).toBe(1);
        // The model's template, with the title and the heading path, is what reached Ollama.
        expect(ollama.embeddedDocuments).toEqual([
            'title: Pods keep their env | text: Fact\n\nA pod keeps the environment it booted with.',
            'title: Pods keep their env | text: How to apply\n\nCheck the pod age before blaming the sync.'
        ]);
    });

    it('passes the stored cursor to the source, or none on a full run', async () => {
        expect.assertions(1);

        sources.adapter.next = { upserts: [], deletes: [], cursor: 'c1', complete: true };
        await indexer.index(dev, MANUAL);
        await indexer.index(dev, MANUAL);
        await indexer.index(dev, { ...MANUAL, full: true });

        expect(sources.adapter.cursors).toEqual([null, 'c1', null]);
    });

    it('re-embeds only the section that changed, and keeps the rows of the others', async () => {
        expect.assertions(5);

        sources.adapter.next = { upserts: [sourceDocument('raw/note.md', NOTE)], deletes: [], cursor: 'c1', complete: true };
        await indexer.index(dev, MANUAL);
        const before = await chunkIds('raw/note.md');

        ollama.requests.length = 0;
        sources.adapter.next = {
            upserts: [sourceDocument('raw/note.md', NOTE.replace('booted with.', 'booted with, until it restarts.'), { version: 'c2' })],
            deletes: [],
            cursor: 'c2',
            complete: false
        };
        await indexer.index(dev, MANUAL);
        const after = await chunkIds('raw/note.md');

        expect(after['How to apply']).toBe(before['How to apply']);
        expect(after.Fact).not.toBe(before.Fact);
        expect(ollama.embeddedDocuments).toHaveLength(1);
        expect(ollama.embeddedDocuments[0]).toContain('until it restarts');
        expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(2);
    });

    it('only bumps the version of a document whose content did not change', async () => {
        expect.assertions(3);

        sources.adapter.next = { upserts: [sourceDocument('raw/note.md', NOTE)], deletes: [], cursor: 'c1', complete: true };
        await indexer.index(dev, MANUAL);
        ollama.requests.length = 0;

        sources.adapter.next = { upserts: [sourceDocument('raw/note.md', NOTE, { version: 'c9' })], deletes: [], cursor: 'c9', complete: true };
        const result = await indexer.index(dev, MANUAL);

        expect(result).toMatchObject({ upserted: 0, unchanged: 1 });
        expect(ollama.requests).toHaveLength(0);
        expect((await postgres.query<{ version: string }>('SELECT version FROM documents')).rows).toEqual([{ version: 'c9' }]);
    });

    it('deletes what the source reports gone, chunks and vectors with it', async () => {
        expect.assertions(4);

        sources.adapter.next = {
            upserts: [sourceDocument('raw/a.md', '## A\n\nalpha'), sourceDocument('raw/b.md', '## B\n\nbeta')],
            deletes: [],
            cursor: 'c1',
            complete: true
        };
        await indexer.index(dev, MANUAL);

        sources.adapter.next = { upserts: [], deletes: ['raw/a.md'], cursor: 'c2', complete: false };
        const result = await indexer.index(dev, MANUAL);

        expect(result.deleted).toBe(1);
        expect((await postgres.query<{ external_id: string }>('SELECT external_id FROM documents')).rows).toEqual([{ external_id: 'raw/b.md' }]);
        expect(await count('SELECT count(*) AS n FROM chunks')).toBe(1);
        expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(1);
    });

    it('keeps a path reported both changed and deleted, as a rewrite paired into a rename is', async () => {
        expect.assertions(2);

        sources.adapter.next = { upserts: [sourceDocument('raw/a.md', '## A\n\nalpha')], deletes: [], cursor: 'c1', complete: true };
        await indexer.index(dev, MANUAL);

        sources.adapter.next = { upserts: [sourceDocument('raw/a.md', '## A\n\nrewritten', { version: 'c2' })], deletes: ['raw/a.md'], cursor: 'c2', complete: false };
        const result = await indexer.index(dev, MANUAL);

        expect(result.deleted).toBe(0);
        expect((await postgres.query<{ external_id: string }>('SELECT external_id FROM documents')).rows).toEqual([{ external_id: 'raw/a.md' }]);
    });

    it('treats a complete snapshot as the whole truth: anything else is deleted', async () => {
        expect.assertions(1);

        sources.adapter.next = {
            upserts: [sourceDocument('raw/a.md', '## A\n\nalpha'), sourceDocument('raw/b.md', '## B\n\nbeta')],
            deletes: [],
            cursor: 'c1',
            complete: true
        };
        await indexer.index(dev, MANUAL);

        sources.adapter.next = { upserts: [sourceDocument('raw/b.md', '## B\n\nbeta')], deletes: [], cursor: 'c5', complete: true };
        await indexer.index(dev, MANUAL);

        expect((await postgres.query<{ external_id: string }>('SELECT external_id FROM documents')).rows).toEqual([{ external_id: 'raw/b.md' }]);
    });

    it('reuses the vectors of a renamed file instead of embedding it again', async () => {
        expect.assertions(2);

        const body = '## Same\n\nidentical text';

        sources.adapter.next = { upserts: [sourceDocument('raw/old.md', body, { title: 'T' })], deletes: [], cursor: 'c1', complete: true };
        await indexer.index(dev, MANUAL);
        ollama.requests.length = 0;

        sources.adapter.next = { upserts: [sourceDocument('raw/new.md', body, { title: 'T' })], deletes: ['raw/old.md'], cursor: 'c2', complete: false };
        await indexer.index(dev, MANUAL);

        expect(ollama.requests).toHaveLength(0);
        expect(await count("SELECT count(*) AS n FROM embeddings e JOIN chunks c ON c.id = e.chunk_id JOIN documents d ON d.id = c.document_id WHERE d.external_id = 'raw/new.md'")).toBe(1);
    });

    it('leaves the vectors pending, without failing, when the embedder is down', async () => {
        expect.assertions(4);

        ollama.failing = true;
        sources.adapter.next = { upserts: [sourceDocument('raw/note.md', NOTE)], deletes: [], cursor: 'c1', complete: true };

        const result = await indexer.index(dev, MANUAL);

        expect(result.embeddingFailed).toEqual(['test-embed:v1']);
        expect(await count('SELECT count(*) AS n FROM chunks')).toBe(2);
        expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(0);

        ollama.failing = false;
        sources.adapter.next = { upserts: [], deletes: [], cursor: 'c1', complete: false };
        await indexer.index(dev, MANUAL);

        expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(2);
    });

    it('indexes the rest of a snapshot when one file holds a NUL byte (a UTF-16 markdown file)', async () => {
        expect.assertions(3);

        // A file saved as UTF-16, decoded as UTF-8 the way GitSourceAdapter decodes every blob.
        const utf16 = Buffer.from('# Saved as UTF-16\n\n## Fact\n\nWindows editors do this.\n', 'utf16le').toString('utf-8');

        sources.adapter.next = {
            upserts: [sourceDocument('raw/utf16.md', utf16), sourceDocument('raw/note.md', NOTE)],
            deletes: [],
            cursor: 'c1',
            complete: true
        };

        await expect(indexer.index(dev, MANUAL)).resolves.toMatchObject({ cursor: 'c1', upserted: 1 });
        expect(await count("SELECT count(*) AS n FROM documents WHERE external_id = 'raw/note.md'")).toBe(1);
        expect(await count("SELECT count(*) AS n FROM documents WHERE external_id = 'raw/utf16.md'")).toBe(0);
    });

    describe('a stopped run', () => {
        const SHUTDOWN = new DOMException('The pod is shutting down.', 'AbortError');

        it('writes nothing when stopped before its first document', async () => {
            expect.assertions(3);

            const stop = new AbortController();

            stop.abort(SHUTDOWN);
            sources.adapter.next = { upserts: [sourceDocument('raw/note.md', NOTE)], deletes: [], cursor: 'c1', complete: true };

            await expect(indexer.index(dev, { ...MANUAL, signal: stop.signal })).rejects.toBe(SHUTDOWN);
            expect(await count('SELECT count(*) AS n FROM documents')).toBe(0);
            expect(await PlatformTest.get<KnowledgeBaseRepository>(KnowledgeBaseRepository).getCursor('development')).toBeNull();
        });

        it('stops embedding mid-way as an interruption, not an embedder failure, keeping what it stored', async () => {
            expect.assertions(4);

            const stop = new AbortController();

            // The shutdown lands while a batch is with the embedder; the call is cancelled.
            vi.spyOn(ollama, 'embed').mockImplementationOnce(() => {
                stop.abort(SHUTDOWN);

                return Promise.reject(SHUTDOWN);
            });
            sources.adapter.next = { upserts: [sourceDocument('raw/note.md', NOTE)], deletes: [], cursor: 'c1', complete: true };

            await expect(indexer.index(dev, { ...MANUAL, signal: stop.signal })).rejects.toBe(SHUTDOWN);
            expect(await count('SELECT count(*) AS n FROM chunks')).toBe(2);
            expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(0);
            // The cursor was stored before embedding began: the next run only embeds what is pending.
            expect(await PlatformTest.get<KnowledgeBaseRepository>(KnowledgeBaseRepository).getCursor('development')).toBe('c1');
        });
    });

    it('defers a backlog above the limit on a scheduled run, and embeds it on a run by hand', async () => {
        expect.assertions(4);

        // A backlog over indexer.maxScheduledEmbeddings (300), as after adding a model.
        vi.spyOn(PlatformTest.get<EmbeddingRepository>(EmbeddingRepository), 'countPending').mockResolvedValue(301);
        sources.adapter.next = { upserts: [sourceDocument('raw/note.md', NOTE)], deletes: [], cursor: 'c1', complete: true };

        const scheduled = await indexer.index(dev, { full: false, manual: false });

        expect(scheduled.embeddingDeferred).toEqual(['test-embed:v1']);
        expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(0);

        const manual = await indexer.index(dev, MANUAL);

        expect(manual.embeddingDeferred).toEqual([]);
        expect(await count('SELECT count(*) AS n FROM embeddings')).toBe(2);
    });

    describe('chunk', () => {
        it('cuts markdown at sections, skipping the frontmatter', () => {
            const chunks = indexer.chunk(dev, sourceDocument('raw/note.md', NOTE));

            expect(chunks.map((chunk) => chunk.heading)).toEqual(['Fact', 'How to apply']);
            expect(chunks.some((chunk) => chunk.body.includes('type: gotcha'))).toBe(false);
        });

        it('follows the source\'s chunking hint', () => {
            const history = '# h\n\n## entry one\n\n### not a boundary\n\ntext\n\n## entry two\n\ntext';
            const chunks = indexer.chunk(dev, sourceDocument('mirror/x/_history.md', history, { chunking: ChunkingMode.Entries }));

            expect(chunks.map((chunk) => chunk.heading)).toEqual(['entry one', 'entry two']);
        });
    });
});
