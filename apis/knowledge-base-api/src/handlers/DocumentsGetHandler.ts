import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { Conflict, NotFound } from '@tsed/exceptions';
import { DocumentMapper } from '../mappers/DocumentMapper.js';
import type { DocumentsGetResponse } from '../models/DocumentsGetResponse.js';
import { KnowledgeBaseAccessService } from '../services/KnowledgeBaseAccessService.js';
import type { DocumentDTO } from '../storage/postgres/dto/DocumentDTO.js';
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
     * returned. The id is tried as given first, so a path that itself holds a `#` still resolves.
     */
    public async execute(id: string, kb: string | undefined): Promise<DocumentsGetResponse> {
        const knowledgeBases = this.access.resolve(kb).map((candidate) => candidate.id);
        const found = CommonUtils.isEmpty(knowledgeBases) ? [] : await this.find(knowledgeBases, id);

        if (CommonUtils.isEmpty(found)) {
            throw new NotFound('Document not found.');
        }

        if (found.length > 1) {
            throw new Conflict('More than one knowledge base holds this id; pass kb.');
        }

        return this.mapper.storageToResponse(found[0]);
    }

    private async find(knowledgeBases: readonly string[], id: string): Promise<DocumentDTO[]> {
        const exact = await this.documents.find(knowledgeBases, id);
        const anchor = id.lastIndexOf('#');

        // A slug never holds a `#`, so the anchor is whatever follows the last one.
        return CommonUtils.isEmpty(exact) && anchor > 0
            ? this.documents.find(knowledgeBases, id.slice(0, anchor))
            : exact;
    }
}
