import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { ConventionsQueryDTO } from '../endpoints/knowledge-base-api/dto/ConventionsQueryDTO.js';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import type { ConventionsOutput } from '../models/ConventionsOutput.js';
import { McpEndpointService } from '../services/McpEndpointService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ConventionsHandler {
    public constructor(
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper,
        private readonly endpoint: McpEndpointService
    ) {}

    /** The endpoint's knowledge base's conventions, read live by the API from its source. */
    public async execute(): Promise<ConventionsOutput> {
        return this.mapper.toConventions(await this.api.conventions(CommonUtils.buildModelStrict(ConventionsQueryDTO, { kb: this.endpoint.knowledgeBase() })));
    }
}
