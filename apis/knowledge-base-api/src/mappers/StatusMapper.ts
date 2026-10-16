import { CommonUtils, MappingUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import type { EmbeddingModelConfig } from '../models/config/EmbeddingsConfig.js';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import type { RunOutcome } from '../models/RunOutcome.enum.js';
import { AreaCount } from '../models/AreaCount.js';
import { IndexerStatus } from '../models/IndexerStatus.js';
import { KnowledgeBaseStatus } from '../models/KnowledgeBaseStatus.js';
import { LastRunStatus } from '../models/LastRunStatus.js';
import { ModelStatus } from '../models/ModelStatus.js';
import { StatusGetResponse } from '../models/StatusGetResponse.js';
import type { KnowledgeBaseDTO } from '../storage/postgres/dto/KnowledgeBaseDTO.js';
import type { KnowledgeBaseStatsDTO } from '../storage/postgres/dto/KnowledgeBaseStatsDTO.js';

export interface KnowledgeBaseState {
    readonly config: KnowledgeBaseConfig;
    /** Undefined until the first boot has written the row. */
    readonly row: KnowledgeBaseDTO | undefined;
    readonly stats: KnowledgeBaseStatsDTO;
    readonly models: readonly EmbeddingModelConfig[];
}

/** Index state to the `GET /status` response. Read-only. */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class StatusMapper extends MappingUtils {
    public toResponse(indexer: { enabled: boolean; intervalMs: number; running: boolean }, states: readonly KnowledgeBaseState[]): StatusGetResponse {
        return CommonUtils.buildModelStrict(StatusGetResponse, {
            indexer: CommonUtils.buildModelStrict(IndexerStatus, indexer),
            knowledgeBases: states.map((state) => this.toKnowledgeBase(state))
        });
    }

    public toKnowledgeBase({ config, row, stats, models }: KnowledgeBaseState): KnowledgeBaseStatus {
        const embedded = new Map(stats.embedded.map((entry) => [entry.model, entry.chunks]));

        return CommonUtils.buildModelStrict(KnowledgeBaseStatus, {
            id: config.id,
            source: config.source,
            cursor: row?.cursor ?? null,
            lastRun: CommonUtils.isNil(row?.lastRunStartedAt) ? null : CommonUtils.buildModelStrict(LastRunStatus, {
                startedAt: row.lastRunStartedAt,
                finishedAt: row.lastRunFinishedAt,
                outcome: row.lastRunOutcome as RunOutcome | null,
                error: row.lastRunError
            }),
            lastSuccessAt: row?.lastSuccessAt ?? null,
            documents: stats.documents,
            chunks: stats.chunks,
            areas: stats.areas.map((area) => CommonUtils.buildModelStrict(AreaCount, area)),
            models: config.models.map((name, index) => {
                const count = embedded.get(name) ?? 0;

                return CommonUtils.buildModelStrict(ModelStatus, {
                    name,
                    dimensions: models.find((model) => model.name === name)?.dimensions ?? 0,
                    active: index === 0,
                    embedded: count,
                    pending: Math.max(0, stats.chunks - count)
                });
            })
        });
    }
}
