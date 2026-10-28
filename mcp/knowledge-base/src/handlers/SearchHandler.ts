import { CommonUtils, DefaultsUtil } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import { SearchQueryDTO } from '../endpoints/knowledge-base-api/dto/SearchQueryDTO.js';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import type { SearchInput } from '../models/SearchInput.js';
import type { SearchOutput } from '../models/SearchOutput.js';
import { McpEndpointService } from '../services/McpEndpointService.js';
import { UpstreamErrorService } from '../services/UpstreamErrorService.js';

/** Sections a search returns when the caller does not say: enough to choose what to `read`. */
export const DEFAULT_SEARCH_LIMIT = 8;

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class SearchHandler {
    public constructor(
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper,
        private readonly endpoint: McpEndpointService,
        private readonly errors: UpstreamErrorService
    ) {}

    /** Searches the endpoint's own knowledge base only; without `kb` the API would search every one the client may read. */
    public async execute(input: SearchInput): Promise<SearchOutput> {
        try {
            const response = await this.api.search(CommonUtils.buildModelStrict(SearchQueryDTO, {
                q: input.query,
                kb: this.endpoint.knowledgeBase(),
                filter: input.filter,
                limit: DefaultsUtil.number(input.limit, DEFAULT_SEARCH_LIMIT)
            }));

            return this.mapper.toSearch(response);
        } catch (error) {
            // http-provider reports the API's 400 as a bad gateway; the agent's input is what was wrong.
            if (this.errors.status(error) === 400) {
                throw new BadRequest('The search was rejected: check `filter` (`key:value` pairs separated by commas, e.g. `area:raw,repos:homelab`) and `query`.');
            }

            throw error;
        }
    }
}
