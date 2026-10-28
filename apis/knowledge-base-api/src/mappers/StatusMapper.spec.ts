import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EmbeddingModelConfig } from '../models/config/EmbeddingsConfig.js';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { RunOutcome } from '../models/RunOutcome.enum.js';
import { StatusGetResponse } from '../models/StatusGetResponse.js';
import { ConfigService } from '../services/ConfigService.js';
import { KnowledgeBaseDTO } from '../storage/postgres/dto/KnowledgeBaseDTO.js';
import { KnowledgeBaseStatsDTO } from '../storage/postgres/dto/KnowledgeBaseStatsDTO.js';
import { StatusMapper } from './StatusMapper.js';

const STARTED = new Date('2026-10-15T08:00:00Z');
const FINISHED = new Date('2026-10-15T08:01:00Z');

const row = (overrides: Partial<KnowledgeBaseDTO> = {}): KnowledgeBaseDTO => CommonUtils.buildModelStrict(KnowledgeBaseDTO, {
    id: 'development',
    source: 'GIT',
    tsConfig: 'english',
    cursor: 'abc',
    lastRunStartedAt: STARTED,
    lastRunFinishedAt: FINISHED,
    lastRunOutcome: RunOutcome.Success,
    lastRunError: null,
    lastSuccessAt: FINISHED,
    ...overrides
});

const stats = CommonUtils.buildModelStrict(KnowledgeBaseStatsDTO, {
    documents: 3,
    chunks: 10,
    areas: [],
    embedded: [{ model: 'test-embed:v1', chunks: 7 }]
});

describe('StatusMapper', () => {
    let mapper: StatusMapper;
    let config: KnowledgeBaseConfig;
    let models: EmbeddingModelConfig[];

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<StatusMapper>(StatusMapper);
        ({ knowledgeBases: [config], embeddings: { models } } = PlatformTest.get<ConfigService>(ConfigService).config);
    });
    afterEach(PlatformTest.reset);

    it('maps the row and counts, with pending chunks per model and the first model active', () => {
        const status = mapper.toKnowledgeBase({ config: { ...config, models: ['test-embed:v1', 'other:1b'] }, row: row(), stats, models });

        expect(status).toEqual(expect.objectContaining({
            id: 'development',
            source: 'GIT',
            cursor: 'abc',
            lastRun: expect.objectContaining({ startedAt: STARTED, finishedAt: FINISHED, outcome: RunOutcome.Success, error: null }),
            lastSuccessAt: FINISHED,
            documents: 3,
            chunks: 10
        }));
        expect(status.models).toEqual([
            expect.objectContaining({ name: 'test-embed:v1', dimensions: 4, active: true, embedded: 7, pending: 3 }),
            expect.objectContaining({ name: 'other:1b', dimensions: 0, active: false, embedded: 0, pending: 10 })
        ]);
    });

    it('has no last run before the first one started, and no row before the first boot wrote it', () => {
        expect(mapper.toKnowledgeBase({ config, row: row({ lastRunStartedAt: null }), stats, models }).lastRun).toBeNull();
        expect(mapper.toKnowledgeBase({ config, row: undefined, stats, models })).toEqual(expect.objectContaining({ cursor: null, lastRun: null, lastSuccessAt: null }));
    });

    it('builds the GET /status response', () => {
        const response = mapper.toResponse({ enabled: true, intervalMs: 300_000, running: false }, [{ config, row: row(), stats, models }]);

        expect(response).toBeInstanceOf(StatusGetResponse);
        expect(response.indexer).toEqual(expect.objectContaining({ enabled: true, intervalMs: 300_000, running: false }));
    });
});
