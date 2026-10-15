import type { BaseLogger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunOutcome } from '../models/RunOutcome.enum.js';
import { KnowledgeBaseDTO } from '../storage/postgres/dto/KnowledgeBaseDTO.js';
import { KnowledgeBaseRepository } from '../storage/postgres/KnowledgeBaseRepository.js';
import { PostgresService } from '../storage/postgres/PostgresService.js';
import { ConfigService } from './ConfigService.js';
import { type IndexResult, IndexerService } from './IndexerService.js';
import { IndexingLoopService } from './IndexingLoopService.js';

const RESULT: IndexResult = {
    cursor: 'c',
    complete: false,
    upserted: 0,
    unchanged: 0,
    deleted: 0,
    embedded: {},
    embeddingFailed: [],
    embeddingDeferred: []
};

const RUN = { knowledgeBases: ['dev'], full: false, manual: true };

describe('IndexingLoopService', () => {
    let loop: IndexingLoopService;
    let indexer: IndexerService;
    let knowledgeBases: KnowledgeBaseRepository;
    let postgres: PostgresService;
    let log: BaseLogger;

    /** The loop with the indexer enabled and short timings, as a pod with the defaults would run, only faster. */
    const enable = (): void => {
        const configService = PlatformTest.get<ConfigService>(ConfigService);

        vi.spyOn(configService, 'config', 'get').mockReturnValue({
            ...configService.config,
            indexer: { ...configService.config.indexer, enabled: true, initialDelayMs: 1, intervalMs: 10 }
        });
    };

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        loop = PlatformTest.get<IndexingLoopService>(IndexingLoopService);
        indexer = PlatformTest.get<IndexerService>(IndexerService);
        knowledgeBases = PlatformTest.get<KnowledgeBaseRepository>(KnowledgeBaseRepository);
        postgres = PlatformTest.get<PostgresService>(PostgresService);
        log = (loop as unknown as { log: BaseLogger }).log;

        vi.spyOn(indexer, 'index').mockResolvedValue(RESULT);
        vi.spyOn(knowledgeBases, 'getCursor').mockResolvedValue('c1');
        vi.spyOn(knowledgeBases, 'recordRunStart').mockResolvedValue();
        vi.spyOn(knowledgeBases, 'recordRunEnd').mockResolvedValue(new Date());
        vi.spyOn(knowledgeBases, 'list').mockResolvedValue([
            CommonUtils.buildModelStrict(KnowledgeBaseDTO, {
                id: 'dev',
                source: 'GIT',
                tsConfig: 'english',
                cursor: 'c1',
                lastRunStartedAt: null,
                lastRunFinishedAt: null,
                lastRunOutcome: null,
                lastRunError: null,
                lastSuccessAt: new Date('2026-10-14T00:00:00Z')
            })
        ]);
    });
    afterEach(async () => {
        await loop.$onDestroy();
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('runs on its own after the initial delay, then again after each interval — incremental', async () => {
        expect.assertions(2);

        enable();
        await loop.$onReady();

        await expect.poll(() => vi.mocked(indexer.index).mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(indexer.index).toHaveBeenCalledWith(expect.objectContaining({ id: 'dev' }), { full: false, manual: false });
    });

    it('does not run on its own when disabled', async () => {
        expect.assertions(1);

        await loop.$onReady();
        await new Promise((resolve) => setTimeout(resolve, 30));

        expect(indexer.index).not.toHaveBeenCalled();
    });

    it('stops scheduling once destroyed', async () => {
        expect.assertions(2);

        enable();
        await loop.$onReady();
        await expect.poll(() => vi.mocked(indexer.index).mock.calls.length).toBeGreaterThanOrEqual(1);
        await loop.$onDestroy();

        const calls = vi.mocked(indexer.index).mock.calls.length;

        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(vi.mocked(indexer.index).mock.calls.length).toBe(calls);
    });

    it('does not build a never-indexed knowledge base on its own', async () => {
        expect.assertions(2);

        const warn = vi.spyOn(log, 'warn');

        vi.mocked(knowledgeBases.getCursor).mockResolvedValue(null);
        await loop.run({ ...RUN, manual: false });

        expect(indexer.index).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith('Knowledge base was never indexed; POST /reindex builds it.', expect.anything());
    });

    it('records a failed knowledge base and goes on', async () => {
        expect.assertions(2);

        const error = vi.spyOn(log, 'error');

        vi.mocked(indexer.index).mockRejectedValue(new Error('source down'));
        await loop.run(RUN);

        expect(knowledgeBases.recordRunEnd).toHaveBeenCalledWith('dev', RunOutcome.Failure, 'source down');
        expect(error).toHaveBeenCalledWith('Indexing a knowledge base failed.', expect.objectContaining({ knowledgeBase: 'dev' }));
    });

    it('skips when another pod holds the lock', async () => {
        expect.assertions(2);

        const info = vi.spyOn(log, 'info');

        vi.spyOn(postgres, 'withTryAdvisoryLock').mockResolvedValue({ acquired: false });
        await loop.run(RUN);

        expect(indexer.index).not.toHaveBeenCalled();
        expect(info).toHaveBeenCalledWith('Another pod is indexing; this run is skipped.', expect.anything());
    });

    it('keeps the loop alive when the database itself fails', async () => {
        expect.assertions(3);

        const error = vi.spyOn(log, 'error');

        vi.spyOn(postgres, 'withTryAdvisoryLock').mockRejectedValue(new Error('database down'));

        expect(loop.trigger(RUN)).toBe(false);
        await expect.poll(() => error.mock.calls.length).toBe(1);
        expect(error).toHaveBeenCalledWith('Indexing run failed.', expect.objectContaining({ error: 'database down' }));
        await vi.waitUntil(() => !loop.isRunning);
    });

    it('does not fail startup when the last runs cannot be read', async () => {
        expect.assertions(2);

        const warn = vi.spyOn(log, 'warn');

        vi.mocked(knowledgeBases.list).mockRejectedValue(new Error('database down'));

        await expect(loop.$onReady()).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith('Could not read the last indexing runs.', expect.anything());
    });
});
