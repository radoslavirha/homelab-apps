import { HttpProviderService } from '@radoslavirha/tsed-http-provider';
import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
// registers the HttpProviderService override bound to this server's config
import '../../providers/HttpProviderProvider.js';
import { DocumentQueryDTO } from './dto/DocumentQueryDTO.js';
import { DocumentResponseDTO } from './dto/DocumentResponseDTO.js';
import { SearchQueryDTO } from './dto/SearchQueryDTO.js';
import { SearchResponseDTO } from './dto/SearchResponseDTO.js';
import { KnowledgeBaseApiEndpoint } from './KnowledgeBaseApiEndpoint.js';

const RESULT = {
    kb: 'dev',
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

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        const client = PlatformTest.get<HttpProviderService<ExternalApi>>(HttpProviderService).get(ExternalApi.KnowledgeBaseApi);

        get = vi.spyOn(client, 'get');
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

        get.mockResolvedValue({ kb: 'dev', externalId: RESULT.externalId, title: 'A note', date: null, url: null, version: 'c1', metadata: {}, content: '# A note' });

        const document = await endpoint.document(CommonUtils.buildModelStrict(DocumentQueryDTO, { id: RESULT.externalId, kb: 'dev' }));

        expect(get).toHaveBeenCalledWith('/documents', { params: { id: RESULT.externalId, kb: 'dev' } });
        expect(document).toBeInstanceOf(DocumentResponseDTO);
        expect(document.content).toBe('# A note');
    });
});
