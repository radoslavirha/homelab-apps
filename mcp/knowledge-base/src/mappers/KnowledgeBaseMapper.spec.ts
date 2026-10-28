import { Serializer } from '@radoslavirha/tsed-common';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommonUtils } from '@radoslavirha/utils';
import { DocumentDeleteRequestDTO } from '../endpoints/knowledge-base-api/dto/DocumentDeleteRequestDTO.js';
import { DocumentDeleteResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentDeleteResponseDTO.js';
import { DocumentResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentResponseDTO.js';
import { DocumentWriteRequestDTO } from '../endpoints/knowledge-base-api/dto/DocumentWriteRequestDTO.js';
import { DocumentWriteResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentWriteResponseDTO.js';
import { NoteCreateRequestDTO } from '../endpoints/knowledge-base-api/dto/NoteCreateRequestDTO.js';
import { NoteCreateResponseDTO } from '../endpoints/knowledge-base-api/dto/NoteCreateResponseDTO.js';
import { NoteTypeDTO } from '../endpoints/knowledge-base-api/dto/NoteTypeDTO.enum.js';
import { SearchResponseDTO } from '../endpoints/knowledge-base-api/dto/SearchResponseDTO.js';
import { CreateNoteInput } from '../models/CreateNoteInput.js';
import { CreateNoteOutput } from '../models/CreateNoteOutput.js';
import { CurrentDocument } from '../models/CurrentDocument.js';
import { DeleteDocumentInput } from '../models/DeleteDocumentInput.js';
import { DeleteDocumentOutput } from '../models/DeleteDocumentOutput.js';
import { NoteType } from '../models/NoteType.enum.js';
import { ReadOutput } from '../models/ReadOutput.js';
import { SearchOutput } from '../models/SearchOutput.js';
import { WriteDocumentInput } from '../models/WriteDocumentInput.js';
import { WriteDocumentOutput } from '../models/WriteDocumentOutput.js';
import { WriteRefusal } from '../models/WriteRefusal.js';
import { KnowledgeBaseMapper } from './KnowledgeBaseMapper.js';

describe('KnowledgeBaseMapper', () => {
    let mapper: KnowledgeBaseMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<KnowledgeBaseMapper>(KnowledgeBaseMapper);
    });
    afterEach(PlatformTest.reset);

    it('turns search results into hits, the document id under `id` and no `kb`: the endpoint is the knowledge base', () => {
        const response = Serializer.deserialize({
            mode: 'VECTOR',
            models: [],
            results: [{
                kb: 'development', externalId: 'raw/a.md', anchor: 'raw/a.md#fact', title: 'A', heading: 'Fact',
                snippet: 's', score: 0.5, date: '2026-01-01', url: 'https://example.test', metadata: { area: 'raw' }
            }]
        }, SearchResponseDTO);

        const output = mapper.toSearch(response);

        expect(output).toBeInstanceOf(SearchOutput);
        expect(output.hits).toEqual([expect.objectContaining({
            id: 'raw/a.md', anchor: 'raw/a.md#fact', title: 'A', heading: 'Fact', snippet: 's', date: '2026-01-01'
        })]);
        expect(output.hits[0]).not.toHaveProperty('kb');
    });

    it('gives a read document its markdown under `markdown`, never `content`', () => {
        // A `content` key would make platform-mcp pass the result through as a finished MCP result.
        const document = Serializer.deserialize({
            kb: 'development', externalId: 'raw/a.md', title: 'A', date: null, url: null, version: 'c1', metadata: { area: 'raw' }, content: '# A'
        }, DocumentResponseDTO);

        const output = mapper.toRead(document);

        expect(output).toBeInstanceOf(ReadOutput);
        expect(output).toEqual(expect.objectContaining({ id: 'raw/a.md', title: 'A', date: null, metadata: { area: 'raw' }, version: 'c1', markdown: '# A' }));
        expect(output).not.toHaveProperty('content');
    });

    it('turns a note\'s fields into the API\'s request, in the endpoint\'s knowledge base, its type as the API spells it', () => {
        const input = CommonUtils.buildModelStrict(CreateNoteInput, {
            title: 'MongoDB stays on latest', type: NoteType.Decision, context: 'c', decisionOrFact: 'd',
            alternativesRejected: ['pinning — drifts'], howToApply: 'h', links: ['homelab:a.md'], repos: ['homelab'], date: '2026-10-20', supersedes: 'raw/old.md'
        });

        const request = mapper.toNoteCreateRequest(input, 'development');

        expect(request).toBeInstanceOf(NoteCreateRequestDTO);
        expect(request).toEqual(expect.objectContaining({
            kb: 'development', title: 'MongoDB stays on latest', type: NoteTypeDTO.Decision, context: 'c', decisionOrFact: 'd',
            alternativesRejected: ['pinning — drifts'], howToApply: 'h', links: ['homelab:a.md'], repos: ['homelab'], date: '2026-10-20', supersedes: 'raw/old.md'
        }));
    });

    it('turns a document write into the API\'s request, a create without a version', () => {
        const request = mapper.toDocumentWriteRequest(CommonUtils.buildModelStrict(WriteDocumentInput, { id: 'work/2026-10-20-x/spec.md', content: '# X' }), 'development');

        expect(request).toBeInstanceOf(DocumentWriteRequestDTO);
        expect(request).toEqual(expect.objectContaining({ kb: 'development', id: 'work/2026-10-20-x/spec.md', content: '# X', version: undefined, message: undefined }));
    });

    it('turns a delete into the API\'s request', () => {
        const request = mapper.toDocumentDeleteRequest(CommonUtils.buildModelStrict(DeleteDocumentInput, { id: 'raw/a.md', version: 'b1', reason: 'mistake' }), 'development');

        expect(request).toBeInstanceOf(DocumentDeleteRequestDTO);
        expect(request).toEqual(expect.objectContaining({ kb: 'development', id: 'raw/a.md', version: 'b1', reason: 'mistake' }));
    });

    it('turns the API\'s answers to writes into the tools\' outputs, the new version kept for the next edit', () => {
        const note = mapper.toCreateNote(Serializer.deserialize({ id: 'raw/a.md', version: 'b1', commit: 'c1' }, NoteCreateResponseDTO));
        const document = mapper.toWriteDocument(Serializer.deserialize({ id: 'work/x/spec.md', version: 'b2', commit: 'c2' }, DocumentWriteResponseDTO));
        const deleted = mapper.toDeleteDocument(Serializer.deserialize({ id: 'raw/a.md', commit: 'c3' }, DocumentDeleteResponseDTO));

        expect(note).toBeInstanceOf(CreateNoteOutput);
        expect(note).toEqual(expect.objectContaining({ id: 'raw/a.md', version: 'b1', commit: 'c1' }));
        expect(document).toBeInstanceOf(WriteDocumentOutput);
        expect(document).toEqual(expect.objectContaining({ id: 'work/x/spec.md', version: 'b2', commit: 'c2' }));
        expect(deleted).toBeInstanceOf(DeleteDocumentOutput);
        expect(deleted).toEqual(expect.objectContaining({ id: 'raw/a.md', commit: 'c3' }));
    });

    it('turns a refusal into a conflict holding the document as it is now', () => {
        const refusal = mapper.toRefusal('It changed.', '# Now', 'b9');

        expect(refusal).toBeInstanceOf(WriteRefusal);
        expect(refusal).toEqual(expect.objectContaining({ statusCode: 409, code: 'E_MCP_TOOL_CONFLICT', message: 'It changed.' }));
        expect(refusal.current).toBeInstanceOf(CurrentDocument);
        expect(refusal.current).toEqual(expect.objectContaining({ content: '# Now', version: 'b9' }));
    });
});
