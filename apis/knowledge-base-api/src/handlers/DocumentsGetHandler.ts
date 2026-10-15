import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { Conflict, NotFound } from '@tsed/exceptions';
import { DocumentMapper } from '../mappers/DocumentMapper.js';
import type { DocumentsGetResponse } from '../models/DocumentsGetResponse.js';
import { KnowledgeBaseAccessService } from '../services/KnowledgeBaseAccessService.js';
import { DocumentRepository } from '../storage/postgres/DocumentRepository.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class DocumentsGetHandler {
    public constructor(
        private readonly access: KnowledgeBaseAccessService,
        private readonly documents: DocumentRepository,
        private readonly mapper: DocumentMapper
    ) {}

    /**
     * `id` may be a search result's anchor: the `#section` part is dropped, the whole document
     * returned.
     */
    public async execute(id: string, kb: string | undefined): Promise<DocumentsGetResponse> {
        const knowledgeBases = this.access.resolve(kb).map((candidate) => candidate.id);
        const externalId = id.split('#')[0];
        const found = CommonUtils.isEmpty(knowledgeBases) ? [] : await this.documents.find(knowledgeBases, externalId);

        if (CommonUtils.isEmpty(found)) {
            throw new NotFound('Document not found.');
        }

        if (found.length > 1) {
            throw new Conflict('More than one knowledge base holds this id; pass kb.');
        }

        return this.mapper.storageToResponse(found[0]);
    }
}
