import type { CallToolResult } from '@modelcontextprotocol/server';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import type { WriteDocumentInput } from '../models/WriteDocumentInput.js';
import type { WriteDocumentOutput } from '../models/WriteDocumentOutput.js';
import { McpEndpointService } from '../services/McpEndpointService.js';
import { UpstreamErrorService } from '../services/UpstreamErrorService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class WriteDocumentHandler {
    public constructor(
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper,
        private readonly endpoint: McpEndpointService,
        private readonly errors: UpstreamErrorService
    ) {}

    /** Creates or rewrites a whole spec or plan, committed for the caller; a refusal carries the document as it is now. */
    public async execute(input: WriteDocumentInput): Promise<WriteDocumentOutput | CallToolResult> {
        try {
            const request = this.mapper.toDocumentWriteRequest(input, this.endpoint.knowledgeBase());

            return this.mapper.toWriteDocument(await this.api.writeDocument(request, this.endpoint.username()));
        } catch (error) {
            return this.errors.refusal(error);
        }
    }
}
