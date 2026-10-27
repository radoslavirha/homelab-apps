import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { DocumentWriteMapper } from '../mappers/DocumentWriteMapper.js';
import type { DocumentsPutRequest } from '../models/DocumentsPutRequest.js';
import type { DocumentsPutResponse } from '../models/DocumentsPutResponse.js';
import { DocumentValidationService } from '../services/DocumentValidationService.js';
import { DocumentWriteService } from '../services/DocumentWriteService.js';
import { KnowledgeBaseAccessService } from '../services/KnowledgeBaseAccessService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class DocumentsPutHandler {
    public constructor(
        private readonly access: KnowledgeBaseAccessService,
        private readonly validation: DocumentValidationService,
        private readonly writes: DocumentWriteService,
        private readonly mapper: DocumentWriteMapper
    ) {}

    /** Validates a whole spec or plan and commits it: a create without `version`, a rewrite with it. */
    public async execute(request: DocumentsPutRequest, header: string | undefined): Promise<DocumentsPutResponse> {
        const onBehalfOf = this.validation.onBehalfOf(header);
        const [kb] = this.access.resolve(request.kb);
        const title = this.validation.workDocument(request.id, request.content);

        this.validation.refuseSecrets(request.message ?? '', 'the message');

        const result = await this.writes.write(kb, request.id, request.content, request.version ?? null, {
            onBehalfOf,
            subject: title,
            body: request.message
        });

        return this.mapper.toDocumentsPutResponse(request.id, result);
    }
}
