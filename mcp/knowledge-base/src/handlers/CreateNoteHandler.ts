import type { CallToolResult } from '@modelcontextprotocol/server';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import type { CreateNoteInput } from '../models/CreateNoteInput.js';
import type { CreateNoteOutput } from '../models/CreateNoteOutput.js';
import { McpEndpointService } from '../services/McpEndpointService.js';
import { UpstreamErrorService } from '../services/UpstreamErrorService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class CreateNoteHandler {
    public constructor(
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper,
        private readonly endpoint: McpEndpointService,
        private readonly errors: UpstreamErrorService
    ) {}

    /** A new note in the endpoint's knowledge base, committed for the caller; a refusal carries the note as it exists. */
    public async execute(input: CreateNoteInput): Promise<CreateNoteOutput | CallToolResult> {
        try {
            const request = this.mapper.toNoteCreateRequest(input, this.endpoint.knowledgeBase());

            return this.mapper.toCreateNote(await this.api.createNote(request, this.endpoint.username()));
        } catch (error) {
            return this.errors.refusal(error);
        }
    }
}
