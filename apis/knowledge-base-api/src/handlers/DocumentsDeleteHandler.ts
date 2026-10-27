import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { DocumentWriteMapper } from '../mappers/DocumentWriteMapper.js';
import type { DocumentsDeleteRequest } from '../models/DocumentsDeleteRequest.js';
import type { DocumentsDeleteResponse } from '../models/DocumentsDeleteResponse.js';
import { DocumentValidationService } from '../services/DocumentValidationService.js';
import { DocumentWriteService } from '../services/DocumentWriteService.js';
import { KnowledgeBaseAccessService } from '../services/KnowledgeBaseAccessService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class DocumentsDeleteHandler {
    public constructor(
        private readonly access: KnowledgeBaseAccessService,
        private readonly validation: DocumentValidationService,
        private readonly writes: DocumentWriteService,
        private readonly mapper: DocumentWriteMapper
    ) {}

    /** Deletes a note or a work/ document at the caller's version, the reason kept in the commit. */
    public async execute(request: DocumentsDeleteRequest, header: string | undefined): Promise<DocumentsDeleteResponse> {
        const onBehalfOf = this.validation.onBehalfOf(header);
        const [kb] = this.access.resolve(request.kb);

        this.validation.deletablePath(request.id);
        this.validation.refuseSecrets(request.reason, 'the reason');

        const result = await this.writes.delete(kb, request.id, request.version, {
            onBehalfOf,
            subject: `delete ${request.id}`,
            reason: request.reason
        });

        return this.mapper.toDocumentsDeleteResponse(request.id, result);
    }
}
