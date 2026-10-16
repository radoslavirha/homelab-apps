import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FullTextMatch } from '../../models/config/FullTextMatch.enum.js';
import { ConfigService } from '../../services/ConfigService.js';
import { chunkDTO, documentDTO, seedDocument, truncateIndex } from '../../test/seed.js';
import { SearchHitDTO } from './dto/SearchHitDTO.js';
import { EmbeddingRepository } from './EmbeddingRepository.js';
import { metadataFilterSql, SearchRepository } from './SearchRepository.js';

const NO_FILTER = new Map<string, string[]>();

describe('SearchRepository', () => {
    let search: SearchRepository;
    let ids: Record<string, string>;

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        search = PlatformTest.get<SearchRepository>(SearchRepository);
        await truncateIndex();

        const configmap = await seedDocument(
            documentDTO('raw/configmap.md', { metadata: { area: 'raw', type: 'gotcha', repos: ['homelab'] } }),
            [chunkDTO(0, 'Fact', 'A pod keeps the environment it booted with after a ConfigMap edit.')]
        );
        const traefik = await seedDocument(
            documentDTO('work/traefik/spec.md', { metadata: { area: 'work', status: 'abandoned', repos: ['homelab', 'homelab-apps'] } }),
            [chunkDTO(0, 'Scope', 'The kubelet probes Traefik on port 8080.')]
        );
        const successor = await seedDocument(
            documentDTO('raw/new.md', { metadata: { area: 'raw', supersedes: 'raw/configmap.md' } }),
            [chunkDTO(0, 'Decision', 'Restart the pod after editing a ConfigMap.')]
        );

        ids = { configmap: configmap.Fact, traefik: traefik.Scope, successor: successor.Decision };
        await PlatformTest.get<EmbeddingRepository>(EmbeddingRepository).insert('test-embed:v1', [
            { chunkId: ids.configmap, vector: [1, 0, 0, 0] },
            { chunkId: ids.traefik, vector: [0, 1, 0, 0] },
            { chunkId: ids.successor, vector: [0.9, 0.1, 0, 0] }
        ]);
    });
    afterEach(PlatformTest.reset);

    describe('fullText', () => {
        it('matches any of the question\'s words, best rank first', async () => {
            expect.assertions(1);

            expect(await search.fullText(['dev'], 'Why does my pod keep its old environment?', FullTextMatch.Any, NO_FILTER, 10))
                .toEqual([ids.configmap, ids.successor]);
        });

        it('needs every word with ALL, so a natural question finds nothing', async () => {
            expect.assertions(2);

            expect(await search.fullText(['dev'], 'Why does my pod keep its old environment?', FullTextMatch.All, NO_FILTER, 10)).toEqual([]);
            expect(await search.fullText(['dev'], 'kubelet probes', FullTextMatch.All, NO_FILTER, 10)).toEqual([ids.traefik]);
        });

        it('finds nothing for a question of stop words, rather than failing', async () => {
            expect.assertions(1);

            expect(await search.fullText(['dev'], 'the of and', FullTextMatch.Any, NO_FILTER, 10)).toEqual([]);
        });

        it('keeps to chunks the given model has no vector for, when asked', async () => {
            expect.assertions(2);

            const pending = await seedDocument(documentDTO('raw/pending.md'), [chunkDTO(0, 'Fact', 'The pod waits for its vector.')]);

            expect(await search.fullText(['dev'], 'pod', FullTextMatch.Any, NO_FILTER, 10, 'test-embed:v1')).toEqual([pending.Fact]);
            expect(await search.fullText(['dev'], 'pod', FullTextMatch.Any, NO_FILTER, 10, 'other-model:v1'))
                .toEqual(expect.arrayContaining([ids.configmap, ids.successor, pending.Fact]));
        });

        it('searches only the given knowledge bases and honours the metadata filter', async () => {
            expect.assertions(2);

            expect(await search.fullText(['other'], 'pod', FullTextMatch.Any, NO_FILTER, 10)).toEqual([]);
            expect(await search.fullText(['dev'], 'pod configmap', FullTextMatch.Any, new Map([['type', ['gotcha']]]), 10)).toEqual([ids.configmap]);
        });
    });

    describe('vector', () => {
        it('returns the nearest chunks first, under the given model only', async () => {
            expect.assertions(2);

            const model = PlatformTest.get<ConfigService>(ConfigService).config.embeddings.models[0];

            expect(await search.vector(['dev'], model, [1, 0, 0, 0], NO_FILTER, 10)).toEqual([ids.configmap, ids.successor, ids.traefik]);
            expect(await search.vector(['dev'], { ...model, name: 'other:1b' }, [1, 0, 0, 0], NO_FILTER, 10)).toEqual([]);
        });

        it('matches a filter value inside an array field', async () => {
            expect.assertions(1);

            const model = PlatformTest.get<ConfigService>(ConfigService).config.embeddings.models[0];

            expect(await search.vector(['dev'], model, [1, 0, 0, 0], new Map([['repos', ['homelab-apps']]]), 10)).toEqual([ids.traefik]);
        });
    });

    describe('details', () => {
        it('reads hits as DTOs with a highlighted snippet, and the start of the chunk when no word matches', async () => {
            expect.assertions(3);

            const hits = await search.details([ids.configmap, ids.traefik], 'environment');
            const byId = new Map(hits.map((hit) => [hit.id, hit]));

            expect(hits[0]).toBeInstanceOf(SearchHitDTO);
            expect(byId.get(ids.configmap)?.snippet).toContain('**environment**');
            expect(byId.get(ids.traefik)?.snippet).toContain('The kubelet probes Traefik');
        });

        it('marks an abandoned document and a superseded one as demoted', async () => {
            expect.assertions(1);

            const hits = await search.details([ids.configmap, ids.traefik, ids.successor], 'pod');

            expect(Object.fromEntries(hits.map((hit) => [hit.externalId, hit.demoted]))).toEqual({
                'raw/configmap.md': true,
                'work/traefik/spec.md': true,
                'raw/new.md': false
            });
        });

        it('returns nothing for no ids', async () => {
            expect.assertions(1);

            expect(await search.details([], 'x')).toEqual([]);
        });
    });

    describe('metadataFilterSql', () => {
        it('ORs the values of one key, ANDs the keys, and matches scalars and array members alike', () => {
            const { sql, values } = metadataFilterSql(new Map([['area', ['raw', 'work']], ['repos', ['homelab']]]), 4);

            expect(sql).toBe(
                ' AND (d.metadata @> $4::jsonb OR d.metadata @> $5::jsonb OR d.metadata @> $6::jsonb OR d.metadata @> $7::jsonb)' +
                ' AND (d.metadata @> $8::jsonb OR d.metadata @> $9::jsonb)'
            );
            expect(values).toEqual([
                '{"area":"raw"}', '{"area":["raw"]}', '{"area":"work"}', '{"area":["work"]}',
                '{"repos":"homelab"}', '{"repos":["homelab"]}'
            ]);
        });
    });
});
