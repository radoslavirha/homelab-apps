import { CommonUtils, DefaultsUtil } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { SearchQueryDTO } from '../endpoints/knowledge-base-api/dto/SearchQueryDTO.js';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import type { SearchInput } from '../models/SearchInput.js';
import type { SearchOutput } from '../models/SearchOutput.js';

/** Sections a search returns when the caller does not say: enough to choose what to `read`. */
export const DEFAULT_SEARCH_LIMIT = 8;

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class SearchHandler {
    public constructor(
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper
    ) {}

    public async execute(input: SearchInput): Promise<SearchOutput> {
        const response = await this.api.search(CommonUtils.buildModelStrict(SearchQueryDTO, {
            q: input.query,
            kb: input.kb,
            filter: input.filter,
            limit: DefaultsUtil.number(input.limit, DEFAULT_SEARCH_LIMIT)
        }));

        return this.mapper.toSearch(response);
    }
}
