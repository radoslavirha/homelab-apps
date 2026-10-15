import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentsGetResponse } from '../models/DocumentsGetResponse.js';
import { DocumentDTO } from '../storage/postgres/dto/DocumentDTO.js';
import { sourceDocument } from '../test/fakes.js';
import { documentDTO } from '../test/seed.js';
import { DocumentMapper } from './DocumentMapper.js';

describe('DocumentMapper', () => {
    let mapper: DocumentMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<DocumentMapper>(DocumentMapper);
    });
    afterEach(PlatformTest.reset);

    it('maps a source document to a storage DTO of its knowledge base, metadata copied rather than shared', () => {
        const source = sourceDocument('raw/a.md', '# A', { date: '2026-01-01', metadata: { area: 'raw', repos: ['x'] } });
        const dto = mapper.sourceToStorage('dev', source);

        expect(dto).toBeInstanceOf(DocumentDTO);
        expect(dto).toEqual(expect.objectContaining({
            kb: 'dev',
            externalId: 'raw/a.md',
            title: 'raw/a.md',
            date: '2026-01-01',
            url: 'https://example.test/blob/c1/raw/a.md',
            content: '# A',
            version: 'c1',
            metadata: { area: 'raw', repos: ['x'] }
        }));
        expect(dto.metadata).not.toBe(source.metadata);
    });

    it('maps a stored document to the GET /documents response', () => {
        const response = mapper.storageToResponse(documentDTO('raw/a.md', { date: '2026-01-01' }));

        expect(response).toBeInstanceOf(DocumentsGetResponse);
        expect(response).toEqual(expect.objectContaining({ kb: 'dev', externalId: 'raw/a.md', date: '2026-01-01', version: 'c1', metadata: { area: 'raw' } }));
    });
});
