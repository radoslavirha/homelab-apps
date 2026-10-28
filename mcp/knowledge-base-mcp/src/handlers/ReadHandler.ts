import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { NotFound } from '@tsed/exceptions';
import { DocumentQueryDTO } from '../endpoints/knowledge-base-api/dto/DocumentQueryDTO.js';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import type { ReadInput } from '../models/ReadInput.js';
import type { ReadOutput } from '../models/ReadOutput.js';
import { McpEndpointService } from '../services/McpEndpointService.js';
import { UpstreamErrorService } from '../services/UpstreamErrorService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ReadHandler {
    public constructor(
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper,
        private readonly endpoint: McpEndpointService,
        private readonly errors: UpstreamErrorService
    ) {}

    /**
     * One whole document of the endpoint's knowledge base. A missing id is the one failure worth
     * its own message: http-provider
     * reports every upstream error as "responded with <status>", which does not tell an agent
     * that ids come from `search`.
     */
    public async execute(input: ReadInput): Promise<ReadOutput> {
        try {
            return this.mapper.toRead(await this.api.document(CommonUtils.buildModelStrict(DocumentQueryDTO, { id: input.id, kb: this.endpoint.knowledgeBase() })));
        } catch (error) {
            if (this.errors.status(error) === NotFound.STATUS) {
                throw new NotFound(`No document "${input.id}" in this knowledge base. Take the id from a search hit.`);
            }

            throw error;
        }
    }
}
