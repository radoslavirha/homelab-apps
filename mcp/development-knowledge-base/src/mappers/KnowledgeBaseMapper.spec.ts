import { Serializer } from '@radoslavirha/tsed-common';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentResponseDTO } from '../endpoints/knowledge-base-api/dto/DocumentResponseDTO.js';
import { SearchResponseDTO } from '../endpoints/knowledge-base-api/dto/SearchResponseDTO.js';
import { StatusResponseDTO } from '../endpoints/knowledge-base-api/dto/StatusResponseDTO.js';
import { ListKnowledgeBasesOutput } from '../models/ListKnowledgeBasesOutput.js';
import { ReadOutput } from '../models/ReadOutput.js';
import { SearchOutput } from '../models/SearchOutput.js';
import { KnowledgeBaseMapper } from './KnowledgeBaseMapper.js';

describe('KnowledgeBaseMapper', () => {
    let mapper: KnowledgeBaseMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<KnowledgeBaseMapper>(KnowledgeBaseMapper);
    });
    afterEach(PlatformTest.reset);

    it('lists knowledge bases with their configured description, and none for one without', () => {
        const status = Serializer.deserialize({
            knowledgeBases: [
                { id: 'dev', documents: 140, chunks: 1779, lastSuccessAt: '2026-10-16T15:09:25.000Z' },
                { id: 'other', documents: 0, chunks: 0, lastSuccessAt: null }
            ]
        }, StatusResponseDTO);

        const output = mapper.toList(status, { dev: { description: 'Decisions and specs.' } });

        expect(output).toBeInstanceOf(ListKnowledgeBasesOutput);
        expect(output.knowledgeBases).toEqual([
            expect.objectContaining({ id: 'dev', description: 'Decisions and specs.', documents: 140, lastIndexedAt: new Date('2026-10-16T15:09:25.000Z') }),
            expect.objectContaining({ id: 'other', description: null, documents: 0, lastIndexedAt: null })
        ]);
    });

    it('turns search results into hits, the document id under `id`', () => {
        const response = Serializer.deserialize({
            mode: 'VECTOR',
            models: [],
            results: [{
                kb: 'dev', externalId: 'raw/a.md', anchor: 'raw/a.md#fact', title: 'A', heading: 'Fact',
                snippet: 's', score: 0.5, date: '2026-01-01', url: 'https://example.test', metadata: { area: 'raw' }
            }]
        }, SearchResponseDTO);

        const output = mapper.toSearch(response);

        expect(output).toBeInstanceOf(SearchOutput);
        expect(output.hits).toEqual([expect.objectContaining({
            kb: 'dev', id: 'raw/a.md', anchor: 'raw/a.md#fact', title: 'A', heading: 'Fact', snippet: 's', date: '2026-01-01'
        })]);
    });

    it('gives a read document its markdown under `markdown`, never `content`', () => {
        // A `content` key would make platform-mcp pass the result through as a finished MCP result.
        const document = Serializer.deserialize({
            kb: 'dev', externalId: 'raw/a.md', title: 'A', date: null, url: null, version: 'c1', metadata: { area: 'raw' }, content: '# A'
        }, DocumentResponseDTO);

        const output = mapper.toRead(document);

        expect(output).toBeInstanceOf(ReadOutput);
        expect(output).toEqual(expect.objectContaining({ kb: 'dev', id: 'raw/a.md', title: 'A', date: null, metadata: { area: 'raw' }, markdown: '# A' }));
        expect(output).not.toHaveProperty('content');
    });
});
