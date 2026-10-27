import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SearchGetResponse } from '../models/SearchGetResponse.js';
import { SearchMode } from '../models/SearchMode.enum.js';
import { SearchResult } from '../models/SearchResult.js';
import { SearchHitDTO } from '../storage/postgres/dto/SearchHitDTO.js';
import { SearchResultMapper } from './SearchResultMapper.js';

const hit = CommonUtils.buildModelStrict(SearchHitDTO, {
    id: '7',
    kb: 'development',
    externalId: 'raw/a.md',
    anchor: 'raw/a.md#fact',
    title: 'A',
    heading: 'Fact',
    snippet: 'a **pod**',
    date: null,
    url: 'https://example.test/raw/a.md',
    metadata: { area: 'raw' },
    demoted: false
});

describe('SearchResultMapper', () => {
    let mapper: SearchResultMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<SearchResultMapper>(SearchResultMapper);
    });
    afterEach(PlatformTest.reset);

    it('maps a hit to a result with its score rounded to six decimals, and leaves the chunk id out', () => {
        const result = mapper.toResult({ hit, score: 1 / 61 });

        expect(result).toBeInstanceOf(SearchResult);
        expect(result).toEqual(expect.objectContaining({
            kb: 'development',
            externalId: 'raw/a.md',
            anchor: 'raw/a.md#fact',
            heading: 'Fact',
            snippet: 'a **pod**',
            score: 0.016393,
            metadata: { area: 'raw' }
        }));
        expect(result).not.toHaveProperty('id');
    });

    it('builds the GET /search response', () => {
        const response = mapper.toResponse(SearchMode.Vector, ['test-embed:v1'], [{ hit, score: 0.5 }]);

        expect(response).toBeInstanceOf(SearchGetResponse);
        expect(response).toEqual(expect.objectContaining({ mode: SearchMode.Vector, models: ['test-embed:v1'], results: [expect.any(SearchResult)] }));
    });
});
