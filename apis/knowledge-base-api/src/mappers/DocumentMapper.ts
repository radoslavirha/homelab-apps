import { CommonUtils, MappingUtils, ObjectUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { DocumentsGetResponse } from '../models/DocumentsGetResponse.js';
import type { SourceDocument } from '../sources/SourceDocument.js';
import { DocumentDTO } from '../storage/postgres/dto/DocumentDTO.js';

/**
 * A document between its three shapes: as a source reports it, as it is stored, and as
 * `GET /documents` returns it. Read-only towards the API — nothing maps a response back into
 * storage, because no endpoint writes documents.
 */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class DocumentMapper extends MappingUtils {
    public sourceToStorage(kb: string, document: SourceDocument): DocumentDTO {
        return CommonUtils.buildModelStrict(DocumentDTO, {
            kb,
            externalId: document.externalId,
            title: document.title,
            date: document.date,
            url: document.url,
            content: document.content,
            version: document.version,
            metadata: ObjectUtils.cloneDeep(document.metadata)
        });
    }

    public storageToResponse(document: DocumentDTO): DocumentsGetResponse {
        return CommonUtils.buildModelStrict(DocumentsGetResponse, {
            kb: document.kb,
            externalId: document.externalId,
            title: document.title,
            date: document.date,
            url: document.url,
            version: document.version,
            metadata: document.metadata,
            content: document.content
        });
    }
}
