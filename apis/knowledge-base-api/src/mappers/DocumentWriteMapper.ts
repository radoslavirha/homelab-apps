import { CommonUtils, MappingUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { DocumentsDeleteResponse } from '../models/DocumentsDeleteResponse.js';
import { DocumentsPutResponse } from '../models/DocumentsPutResponse.js';
import { NotesPostResponse } from '../models/NotesPostResponse.js';
import type { SourceDeleteResult, SourceWriteResult } from '../sources/SourceWriter.js';

/** What a write left in the source, to the write routes' responses. */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class DocumentWriteMapper extends MappingUtils {
    public toNotesPostResponse(id: string, result: SourceWriteResult): NotesPostResponse {
        return CommonUtils.buildModelStrict(NotesPostResponse, { id, version: result.version, commit: result.commit });
    }

    public toDocumentsPutResponse(id: string, result: SourceWriteResult): DocumentsPutResponse {
        return CommonUtils.buildModelStrict(DocumentsPutResponse, { id, version: result.version, commit: result.commit });
    }

    public toDocumentsDeleteResponse(id: string, result: SourceDeleteResult): DocumentsDeleteResponse {
        return CommonUtils.buildModelStrict(DocumentsDeleteResponse, { id, commit: result.commit });
    }
}
