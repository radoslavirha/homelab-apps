import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentsDeleteResponse } from '../models/DocumentsDeleteResponse.js';
import { DocumentsPutResponse } from '../models/DocumentsPutResponse.js';
import { NotesPostResponse } from '../models/NotesPostResponse.js';
import { DocumentWriteMapper } from './DocumentWriteMapper.js';

describe('DocumentWriteMapper', () => {
    let mapper: DocumentWriteMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<DocumentWriteMapper>(DocumentWriteMapper);
    });
    afterEach(PlatformTest.reset);

    it('answers a written note with its id, new version and commit', () => {
        const response = mapper.toNotesPostResponse('raw/2026-10-20-a.md', { version: 'b1', commit: 'c1' });

        expect(response).toBeInstanceOf(NotesPostResponse);
        expect(response).toEqual({ id: 'raw/2026-10-20-a.md', version: 'b1', commit: 'c1' });
    });

    it('answers a written document with its id, new version and commit', () => {
        const response = mapper.toDocumentsPutResponse('work/2026-10-20-a/spec.md', { version: 'b1', commit: 'c1' });

        expect(response).toBeInstanceOf(DocumentsPutResponse);
        expect(response).toEqual({ id: 'work/2026-10-20-a/spec.md', version: 'b1', commit: 'c1' });
    });

    it('answers a delete with its id and commit', () => {
        const response = mapper.toDocumentsDeleteResponse('raw/2026-10-20-a.md', { commit: 'c1' });

        expect(response).toBeInstanceOf(DocumentsDeleteResponse);
        expect(response).toEqual({ id: 'raw/2026-10-20-a.md', commit: 'c1' });
    });
});
