import { HttpProviderService } from '@radoslavirha/tsed-http-provider';
import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
// registers the HttpProviderService override bound to this server's config
import '../../providers/HttpProviderProvider.js';
import { DocumentDeleteRequestDTO } from './dto/DocumentDeleteRequestDTO.js';
import { DocumentDeleteResponseDTO } from './dto/DocumentDeleteResponseDTO.js';
import { DocumentQueryDTO } from './dto/DocumentQueryDTO.js';
import { DocumentResponseDTO } from './dto/DocumentResponseDTO.js';
import { DocumentWriteRequestDTO } from './dto/DocumentWriteRequestDTO.js';
import { DocumentWriteResponseDTO } from './dto/DocumentWriteResponseDTO.js';
import { NoteCreateRequestDTO } from './dto/NoteCreateRequestDTO.js';
import { NoteCreateResponseDTO } from './dto/NoteCreateResponseDTO.js';
import { NoteTypeDTO } from './dto/NoteTypeDTO.enum.js';
import { SearchQueryDTO } from './dto/SearchQueryDTO.js';
import { SearchResponseDTO } from './dto/SearchResponseDTO.js';
import { KnowledgeBaseApiEndpoint } from './KnowledgeBaseApiEndpoint.js';

const RESULT = {
    kb: 'development',
    externalId: 'raw/2026-01-01-a-note.md',
    anchor: 'raw/2026-01-01-a-note.md#fact',
    title: 'A note',
    heading: 'Fact',
    snippet: 'A **pod** keeps its environment.',
    score: 0.016393,
    date: '2026-01-01',
    url: null,
    metadata: { area: 'raw', type: 'gotcha' }
};

describe('KnowledgeBaseApiEndpoint', () => {
    let endpoint: KnowledgeBaseApiEndpoint;
    let get: ReturnType<typeof vi.spyOn>;
    let post: ReturnType<typeof vi.spyOn>;
    let put: ReturnType<typeof vi.spyOn>;
    let request: ReturnType<typeof vi.spyOn>;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        const client = PlatformTest.get<HttpProviderService<ExternalApi>>(HttpProviderService).get(ExternalApi.KnowledgeBaseApi);

        get = vi.spyOn(client, 'get');
        post = vi.spyOn(client, 'post');
        put = vi.spyOn(client, 'put');
        request = vi.spyOn(client, 'request');
        endpoint = PlatformTest.get<KnowledgeBaseApiEndpoint>(KnowledgeBaseApiEndpoint);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('searches with the query as query-string parameters, leaving unset ones out', async () => {
        expect.assertions(3);

        get.mockResolvedValue({ mode: 'VECTOR', models: ['embeddinggemma:300m'], results: [RESULT] });

        const response = await endpoint.search(CommonUtils.buildModelStrict(SearchQueryDTO, { q: 'why does the pod keep its env?', limit: 8 }));

        expect(get).toHaveBeenCalledWith('/search', { params: { q: 'why does the pod keep its env?', limit: 8 } });
        expect(response).toBeInstanceOf(SearchResponseDTO);
        expect(response.results[0]).toEqual(expect.objectContaining({ anchor: RESULT.anchor, snippet: RESULT.snippet, metadata: RESULT.metadata }));
    });

    it('reads a whole document by id and knowledge base', async () => {
        expect.assertions(3);

        get.mockResolvedValue({ kb: 'development', externalId: RESULT.externalId, title: 'A note', date: null, url: null, version: 'c1', metadata: {}, content: '# A note' });

        const document = await endpoint.document(CommonUtils.buildModelStrict(DocumentQueryDTO, { id: RESULT.externalId, kb: 'development' }));

        expect(get).toHaveBeenCalledWith('/documents', { params: { id: RESULT.externalId, kb: 'development' } });
        expect(document).toBeInstanceOf(DocumentResponseDTO);
        expect(document.content).toBe('# A note');
    });

    it('creates a note with its fields as the body, naming the user it is for in On-Behalf-Of, sent once', async () => {
        expect.assertions(3);

        post.mockResolvedValue({ id: 'raw/2026-10-20-a.md', version: 'b1', commit: 'c1' });

        const response = await endpoint.createNote(CommonUtils.buildModelStrict(NoteCreateRequestDTO, {
            kb: 'development', title: 'A', type: NoteTypeDTO.Gotcha, context: 'c', decisionOrFact: 'd'
        }), 'radoslav');

        expect(post).toHaveBeenCalledWith(
            '/notes',
            { kb: 'development', title: 'A', type: 'GOTCHA', context: 'c', decisionOrFact: 'd' },
            { headers: { 'On-Behalf-Of': 'radoslav' }, retry: false }
        );
        expect(response).toBeInstanceOf(NoteCreateResponseDTO);
        expect(response).toEqual(expect.objectContaining({ id: 'raw/2026-10-20-a.md', version: 'b1', commit: 'c1' }));
    });

    it('writes a whole document, naming the user it is for in On-Behalf-Of, sent once', async () => {
        expect.assertions(3);

        put.mockResolvedValue({ id: 'work/2026-10-20-x/spec.md', version: 'b2', commit: 'c2' });

        const response = await endpoint.writeDocument(CommonUtils.buildModelStrict(DocumentWriteRequestDTO, {
            kb: 'development', id: 'work/2026-10-20-x/spec.md', content: '# X', version: 'b1', message: 'why'
        }), 'radoslav');

        expect(put).toHaveBeenCalledWith(
            '/documents',
            { kb: 'development', id: 'work/2026-10-20-x/spec.md', content: '# X', version: 'b1', message: 'why' },
            { headers: { 'On-Behalf-Of': 'radoslav' }, retry: false }
        );
        expect(response).toBeInstanceOf(DocumentWriteResponseDTO);
        expect(response.version).toBe('b2');
    });

    it('deletes a document with a body, which DELETE carries here, naming the user it is for in On-Behalf-Of, sent once', async () => {
        expect.assertions(3);

        request.mockResolvedValue({ id: 'raw/a.md', commit: 'c3' });

        const response = await endpoint.deleteDocument(CommonUtils.buildModelStrict(DocumentDeleteRequestDTO, {
            kb: 'development', id: 'raw/a.md', version: 'b1', reason: 'mistake'
        }), 'radoslav');

        expect(request).toHaveBeenCalledWith({
            method: 'DELETE',
            url: '/documents',
            body: { kb: 'development', id: 'raw/a.md', version: 'b1', reason: 'mistake' },
            headers: { 'On-Behalf-Of': 'radoslav' },
            retry: false
        });
        expect(response).toBeInstanceOf(DocumentDeleteResponseDTO);
        expect(response.commit).toBe('c3');
    });
});
