import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chunkDTO, documentDTO, seedDocument, truncateIndex } from '../../test/seed.js';
import { PendingChunkDTO } from './dto/PendingChunkDTO.js';
import { EmbeddingRepository } from './EmbeddingRepository.js';
import { PostgresService } from './PostgresService.js';

/** `config/test.json`'s model: 4 dimensions, its HNSW index created by the migrator. */
const MODEL = 'test-embed:v1';

describe('EmbeddingRepository', () => {
    let embeddings: EmbeddingRepository;
    let postgres: PostgresService;

    const vectors = async (): Promise<number> => Number((await postgres.query<{ n: string }>('SELECT count(*) AS n FROM embeddings')).rows[0].n);

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        embeddings = PlatformTest.get<EmbeddingRepository>(EmbeddingRepository);
        postgres = PlatformTest.get<PostgresService>(PostgresService);
        await truncateIndex();
    });
    afterEach(PlatformTest.reset);

    it('lists and counts the chunks with no vector for a model, oldest first, with what a template needs', async () => {
        expect.assertions(4);

        const ids = await seedDocument(documentDTO('raw/a.md', { title: 'A doc' }), [chunkDTO(0, 'One', 'first'), chunkDTO(1, 'Two', 'second')]);

        await embeddings.insert(MODEL, [{ chunkId: ids.One, vector: [1, 0, 0, 0] }]);

        const pending = await embeddings.pending('dev', MODEL, 10);

        expect(await embeddings.countPending('dev', MODEL)).toBe(1);
        expect(await embeddings.countPending('dev', 'other:1b')).toBe(2);
        expect(pending[0]).toBeInstanceOf(PendingChunkDTO);
        expect(pending).toEqual([expect.objectContaining({ id: ids.Two, title: 'A doc', heading: 'Two', body: 'second' })]);
    });

    it('stores vectors, skips a chunk deleted meanwhile, and ignores a second write for the same chunk', async () => {
        expect.assertions(3);

        const ids = await seedDocument(documentDTO('raw/a.md'), [chunkDTO(0, 'One', 'first')]);

        expect(await embeddings.insert(MODEL, [{ chunkId: ids.One, vector: [1, 0, 0, 0] }, { chunkId: '999999', vector: [0, 1, 0, 0] }])).toBe(1);
        expect(await embeddings.insert(MODEL, [{ chunkId: ids.One, vector: [0, 0, 1, 0] }])).toBe(0);
        expect(await embeddings.insert(MODEL, [])).toBe(0);
    });

    it('refuses a vector of the wrong length for the model, through the cast in its index', async () => {
        expect.assertions(1);

        const ids = await seedDocument(documentDTO('raw/a.md'), [chunkDTO(0, 'One', 'first')]);

        await expect(embeddings.insert(MODEL, [{ chunkId: ids.One, vector: [1, 0, 0] }])).rejects.toThrow(/dimensions/);
    });

    it('copies a vector to a chunk with the same hash instead of leaving it pending', async () => {
        expect.assertions(3);

        const old = await seedDocument(documentDTO('raw/old.md'), [chunkDTO(0, 'Same', 'text', 'h')]);

        await embeddings.insert(MODEL, [{ chunkId: old.Same, vector: [1, 0, 0, 0] }]);
        await seedDocument(documentDTO('raw/new.md'), [chunkDTO(0, 'Same', 'text', 'h')]);

        expect(await embeddings.copyByHash('dev', MODEL)).toBe(1);
        expect(await embeddings.countPending('dev', MODEL)).toBe(0);
        expect(await vectors()).toBe(2);
    });
});
