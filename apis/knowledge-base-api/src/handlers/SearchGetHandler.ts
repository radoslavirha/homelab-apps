import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import { SearchResultMapper } from '../mappers/SearchResultMapper.js';
import type { SearchGetResponse } from '../models/SearchGetResponse.js';
import { ConfigService } from '../services/ConfigService.js';
import { KnowledgeBaseAccessService } from '../services/KnowledgeBaseAccessService.js';
import { MetadataFilterService } from '../services/MetadataFilterService.js';
import { SearchService } from '../services/SearchService.js';

export interface SearchParams {
    readonly q: string;
    readonly kb?: string;
    readonly filter?: string;
    readonly limit?: number;
    readonly model?: string;
    readonly fullTextWeight?: number;
    readonly vectorWeight?: number;
}

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class SearchGetHandler {
    public constructor(
        private readonly configService: ConfigService,
        private readonly access: KnowledgeBaseAccessService,
        private readonly filters: MetadataFilterService,
        private readonly search: SearchService,
        private readonly mapper: SearchResultMapper
    ) {}

    public async execute(params: SearchParams): Promise<SearchGetResponse> {
        if (params.q.includes('\0')) {
            throw new BadRequest('Invalid q; a NUL byte is not allowed.');
        }

        const outcome = await this.search.search({
            question: params.q,
            knowledgeBases: this.access.resolve(params.kb),
            filter: this.filters.parse(params.filter),
            limit: params.limit ?? this.configService.config.search.defaultLimit,
            ...(CommonUtils.isUndefined(params.model) ? {} : { model: params.model }),
            weights: {
                ...(CommonUtils.isUndefined(params.fullTextWeight) ? {} : { fullText: params.fullTextWeight }),
                ...(CommonUtils.isUndefined(params.vectorWeight) ? {} : { vector: params.vectorWeight })
            }
        });

        return this.mapper.toResponse(outcome.mode, outcome.models, outcome.hits);
    }
}
