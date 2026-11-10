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

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class SearchHandler {
    public constructor(
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper,
        private readonly endpoint: McpEndpointService,
        private readonly errors: UpstreamErrorService
    ) {}

    /**
     * Searches the endpoint's own knowledge base only; without `kb` the API would search every one
     * the client may read. How it searches is the endpoint's `search` config: the agent's `limit`
     * (else `defaultLimit`) is lowered to `maxLimit`, and the model and weights are always the
     * endpoint's — the weights are sent even at their defaults, so the API's own config never decides.
     */
    public async execute(input: SearchInput): Promise<SearchOutput> {
        const search = this.endpoint.searchConfig();

        try {
            const response = await this.api.search(CommonUtils.buildModelStrict(SearchQueryDTO, {
                q: input.query,
                kb: this.endpoint.knowledgeBase(),
                filter: input.filter,
                limit: Math.min(DefaultsUtil.number(input.limit, search.defaultLimit), search.maxLimit),
                model: search.model,
                fullTextWeight: search.weights.fullText,
                vectorWeight: search.weights.vector
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
