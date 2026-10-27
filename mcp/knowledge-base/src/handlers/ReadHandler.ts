import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { Exception, NotFound } from '@tsed/exceptions';
import { DocumentQueryDTO } from '../endpoints/knowledge-base-api/dto/DocumentQueryDTO.js';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import type { ReadInput } from '../models/ReadInput.js';
import type { ReadOutput } from '../models/ReadOutput.js';
import { McpEndpointService } from '../services/McpEndpointService.js';

/** The status the upstream answered with, kept by http-provider as the translated error's `origin`. */
const upstreamStatus = (error: unknown): number | undefined => {
    const origin = error instanceof Exception ? (error.origin as { response?: { status?: number } } | undefined) : undefined;

    return origin?.response?.status;
};

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ReadHandler {
    public constructor(
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper,
        private readonly endpoint: McpEndpointService
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
            if (upstreamStatus(error) === 404) {
                throw new NotFound(`No document "${input.id}" in this knowledge base. Take the id from a search hit.`);
            }

            throw error;
        }
    }
}
