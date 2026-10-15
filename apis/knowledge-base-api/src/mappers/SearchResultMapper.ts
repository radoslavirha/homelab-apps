import { CommonUtils, MappingUtils, NumberUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { SearchGetResponse } from '../models/SearchGetResponse.js';
import type { SearchMode } from '../models/SearchMode.enum.js';
import { SearchResult } from '../models/SearchResult.js';
import type { SearchHitDTO } from '../storage/postgres/dto/SearchHitDTO.js';

export interface ScoredHit {
    readonly hit: SearchHitDTO;
    readonly score: number;
}

/** Search rows to the `GET /search` response. Read-only: nothing maps a result back. */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class SearchResultMapper extends MappingUtils {
    public toResponse(mode: SearchMode, models: readonly string[], hits: readonly ScoredHit[]): SearchGetResponse {
        return CommonUtils.buildModelStrict(SearchGetResponse, {
            mode,
            models: [...models],
            results: hits.map((scored) => this.toResult(scored))
        });
    }

    public toResult({ hit, score }: ScoredHit): SearchResult {
        return CommonUtils.buildModelStrict(SearchResult, {
            kb: hit.kb,
            externalId: hit.externalId,
            anchor: hit.anchor,
            title: hit.title,
            heading: hit.heading,
            snippet: hit.snippet,
            score: NumberUtils.round(score, 6),
            date: hit.date,
            url: hit.url,
            metadata: hit.metadata
        });
    }
}
