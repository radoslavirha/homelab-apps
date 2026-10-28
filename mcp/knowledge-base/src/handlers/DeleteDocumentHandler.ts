import type { CallToolResult } from '@modelcontextprotocol/server';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import type { DeleteDocumentInput } from '../models/DeleteDocumentInput.js';
import type { DeleteDocumentOutput } from '../models/DeleteDocumentOutput.js';
import { McpEndpointService } from '../services/McpEndpointService.js';
import { UpstreamErrorService } from '../services/UpstreamErrorService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class DeleteDocumentHandler {
    public constructor(
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper,
        private readonly endpoint: McpEndpointService,
        private readonly errors: UpstreamErrorService
    ) {}

    /** Deletes a note or a spec or plan at its version, committed for the caller; a refusal carries the document as it is now. */
    public async execute(input: DeleteDocumentInput): Promise<DeleteDocumentOutput | CallToolResult> {
        try {
            const request = this.mapper.toDocumentDeleteRequest(input, this.endpoint.knowledgeBase());

            return this.mapper.toDeleteDocument(await this.api.deleteDocument(request, this.endpoint.username()));
        } catch (error) {
            return this.errors.refusal(error);
        }
    }
}
