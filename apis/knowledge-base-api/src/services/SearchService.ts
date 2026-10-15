import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import type { ScoredHit } from '../mappers/SearchResultMapper.js';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import type { SearchWeights } from '../models/config/SearchConfig.js';
import type { MetadataFilter } from '../models/MetadataFilter.js';
import { SearchMode } from '../models/SearchMode.enum.js';
import {
    ATTR_SEARCH_MODE,
    knowledgeBaseInstruments,
    SEARCH_MODE_VALUE_FULLTEXT,
    SEARCH_MODE_VALUE_HYBRID,
    SEARCH_MODE_VALUE_VECTOR
} from '../otel/telemetry.js';
import { SearchRepository } from '../storage/postgres/SearchRepository.js';
import { ConfigService } from './ConfigService.js';
import { EmbeddingService } from './EmbeddingService.js';
import { type Ranking, RankFusionService } from './RankFusionService.js';

export interface SearchQuery {
    readonly question: string;
    /** Already narrowed to what the caller may read. */
    readonly knowledgeBases: readonly KnowledgeBaseConfig[];
    readonly filter: MetadataFilter;
    readonly limit: number;
    /** Answer the vector leg with this model instead of each KB's first — to compare models. */
    readonly model?: string;
    /** Per-request RRF weights over the configured ones — to measure a blend before configuring it. */
    readonly weights?: Partial<SearchWeights>;
}

/** Weight of the full-text leg when it stands in for a vector leg that could not run. */
const FALLBACK_WEIGHT = 1;

const METRIC_MODE: Record<SearchMode, string> = {
    [SearchMode.Hybrid]: SEARCH_MODE_VALUE_HYBRID,
    [SearchMode.Vector]: SEARCH_MODE_VALUE_VECTOR,
    [SearchMode.FullText]: SEARCH_MODE_VALUE_FULLTEXT
};

export interface SearchOutcome {
    readonly mode: SearchMode;
    readonly models: readonly string[];
    readonly hits: readonly ScoredHit[];
}

/**
 * Search over two legs — full-text and one vector leg per model — merged with weighted
 * reciprocal rank fusion. With the default weights the full-text leg is 0 (vector alone measured
 * best), so it runs only for what the vector leg cannot answer.
 *
 * **Degrades instead of failing.** A knowledge base without a vector leg — no model configured,
 * or the question could not be embedded (Ollama down, the model not loaded in time) — is answered
 * by full-text, and a search answered by full-text alone says `FULLTEXT`. A database error is not
 * degraded: without the database there is nothing to answer from.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class SearchService {
    private readonly log: BaseLogger;

    public constructor(
        private readonly configService: ConfigService,
        private readonly searchRepository: SearchRepository,
        private readonly embeddings: EmbeddingService,
        private readonly rankFusion: RankFusionService,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('SEARCH');
    }

    public async search(query: SearchQuery): Promise<SearchOutcome> {
        const config = this.configService.config.search;
        const ids = query.knowledgeBases.map((kb) => kb.id);

        if (CommonUtils.isEmpty(ids)) {
            return { mode: SearchMode.FullText, models: [], hits: [] };
        }

        const weights: SearchWeights = { ...config.weights, ...query.weights };
        const rankings: Ranking[] = [];
        const models: string[] = [];
        const covered = new Set<string>();

        if (weights.vector > 0) {
            for (const [name, group] of this.byModel(query)) {
                const model = this.embeddings.model(name)!;
                let vector: number[];

                try {
                    vector = await this.embeddings.embedQuery(model, query.question);
                } catch (error) {
                    this.log.warn('Could not embed the question; answering from full-text.', {
                        event: 'SEARCH_DEGRADED',
                        model: name,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    continue;
                }

                rankings.push({
                    ids: await this.searchRepository.vector(group, model, vector, query.filter, config.candidates),
                    weight: weights.vector
                });
                models.push(name);
                group.forEach((id) => covered.add(id));
            }
        }

        // Full-text over every KB when it is weighted in; otherwise only where no vector leg ran.
        const fullTextKbs = weights.fullText > 0 ? ids : ids.filter((id) => !covered.has(id));

        if (!CommonUtils.isEmpty(fullTextKbs)) {
            rankings.push({
                ids: await this.searchRepository.fullText(fullTextKbs, query.question, config.fullTextMatch, query.filter, config.candidates),
                weight: weights.fullText > 0 ? weights.fullText : FALLBACK_WEIGHT
            });
        }

        const fused = this.rankFusion.fuse(rankings, config.rrfK);
        const details = new Map((await this.searchRepository.details(fused.map((hit) => hit.id), query.question))
            .map((hit) => [hit.id, hit]));
        const ranked = fused
            .map((fusedHit) => ({ hit: details.get(fusedHit.id), score: fusedHit.score }))
            .filter((scored): scored is ScoredHit => CommonUtils.notUndefined(scored.hit));
        // Stable: within each group the fusion order holds.
        const hits = [...ranked.filter((scored) => !scored.hit.demoted), ...ranked.filter((scored) => scored.hit.demoted)];
        const mode = CommonUtils.isEmpty(models)
            ? SearchMode.FullText
            : CommonUtils.isEmpty(fullTextKbs) ? SearchMode.Vector : SearchMode.Hybrid;

        knowledgeBaseInstruments().searches.add(1, { [ATTR_SEARCH_MODE]: METRIC_MODE[mode] });

        return { mode, models, hits: hits.slice(0, query.limit) };
    }

    /** KB ids grouped by the model that answers their vector leg. KBs with no model have none. */
    private byModel(query: SearchQuery): Map<string, string[]> {
        const groups = new Map<string, string[]>();

        if (CommonUtils.notUndefined(query.model) && !query.knowledgeBases.some((kb) => kb.models.includes(query.model!))) {
            throw new BadRequest('No knowledge base searched is embedded with that model.');
        }

        for (const kb of query.knowledgeBases) {
            const model = query.model ?? kb.models[0];

            if (CommonUtils.notUndefined(model) && kb.models.includes(model)) {
                groups.set(model, [...(groups.get(model) ?? []), kb.id]);
            }
        }

        return groups;
    }
}
