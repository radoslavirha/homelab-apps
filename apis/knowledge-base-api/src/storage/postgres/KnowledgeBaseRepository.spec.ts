import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunOutcome } from '../../models/RunOutcome.enum.js';
import { chunkDTO, documentDTO, seedDocument, truncateIndex } from '../../test/seed.js';
import { KnowledgeBaseDTO } from './dto/KnowledgeBaseDTO.js';
import { KnowledgeBaseStatsDTO } from './dto/KnowledgeBaseStatsDTO.js';
import { EmbeddingRepository } from './EmbeddingRepository.js';
import { KnowledgeBaseRepository } from './KnowledgeBaseRepository.js';

describe('KnowledgeBaseRepository', () => {
    let knowledgeBases: KnowledgeBaseRepository;

    const row = async (): Promise<KnowledgeBaseDTO> => (await knowledgeBases.list(['development']))[0];

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        knowledgeBases = PlatformTest.get<KnowledgeBaseRepository>(KnowledgeBaseRepository);
        await truncateIndex();
    });
    afterEach(PlatformTest.reset);

    it('reads the rows the migrator wrote as DTOs', async () => {
        expect.assertions(3);

        const [dev] = await knowledgeBases.list(['development', 'missing']);

        expect(dev).toBeInstanceOf(KnowledgeBaseDTO);
        expect(dev).toEqual(expect.objectContaining({ id: 'development', source: 'GIT', tsConfig: 'english', cursor: null, lastSuccessAt: null }));
        expect(await knowledgeBases.list(['missing'])).toEqual([]);
    });

    it('stores and reads the cursor, null before the first run', async () => {
        expect.assertions(2);

        expect(await knowledgeBases.getCursor('development')).toBeNull();
        await knowledgeBases.setCursor('development', 'abc');
        expect(await knowledgeBases.getCursor('development')).toBe('abc');
    });

    it('records a successful run and its time', async () => {
        expect.assertions(3);

        await knowledgeBases.recordRunStart('development');
        const lastSuccess = await knowledgeBases.recordRunEnd('development', RunOutcome.Success, null);
        const dev = await row();

        expect(lastSuccess).toBeInstanceOf(Date);
        expect(dev).toEqual(expect.objectContaining({ lastRunOutcome: RunOutcome.Success, lastRunError: null, lastSuccessAt: lastSuccess }));
        expect(dev.lastRunFinishedAt!.getTime()).toBeGreaterThanOrEqual(dev.lastRunStartedAt!.getTime());
    });

    it('records a failure without moving the last success, and shortens a long error', async () => {
        expect.assertions(3);

        const succeeded = await knowledgeBases.recordRunEnd('development', RunOutcome.Success, null);

        await knowledgeBases.recordRunStart('development');
        await knowledgeBases.recordRunEnd('development', RunOutcome.Failure, 'x'.repeat(2000));
        const dev = await row();

        expect(dev.lastRunOutcome).toBe(RunOutcome.Failure);
        expect(dev.lastRunError).toHaveLength(500);
        expect(dev.lastSuccessAt).toEqual(succeeded);
    });

    it('clears the outcome of the previous run when a run starts', async () => {
        expect.assertions(1);

        await knowledgeBases.recordRunEnd('development', RunOutcome.Failure, 'boom');
        await knowledgeBases.recordRunStart('development');

        expect(await row()).toEqual(expect.objectContaining({ lastRunFinishedAt: null, lastRunOutcome: null, lastRunError: null }));
    });

    it('counts documents, chunks, documents per area and vectors per model', async () => {
        expect.assertions(2);

        const ids = await seedDocument(documentDTO('raw/a.md'), [chunkDTO(0, 'A', 'alpha'), chunkDTO(1, 'B', 'beta')]);

        await seedDocument(documentDTO('work/b/spec.md'), [chunkDTO(0, 'C', 'gamma')]);
        await PlatformTest.get<EmbeddingRepository>(EmbeddingRepository).insert('test-embed:v1', [{ chunkId: ids.A, vector: [1, 0, 0, 0] }]);

        const stats = await knowledgeBases.stats('development');

        expect(stats).toBeInstanceOf(KnowledgeBaseStatsDTO);
        expect(stats).toEqual(expect.objectContaining({
            documents: 2,
            chunks: 3,
            areas: [expect.objectContaining({ area: 'raw', documents: 1 }), expect.objectContaining({ area: 'work', documents: 1 })],
            embedded: [expect.objectContaining({ model: 'test-embed:v1', chunks: 1 })]
        }));
    });
});
