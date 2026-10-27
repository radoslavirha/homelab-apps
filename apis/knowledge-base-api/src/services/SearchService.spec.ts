import { CommonUtils } from '@radoslavirha/utils';
import { BadRequest } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { FullTextMatch } from '../models/config/FullTextMatch.enum.js';
import { SearchMode } from '../models/SearchMode.enum.js';
import { SearchHitDTO } from '../storage/postgres/dto/SearchHitDTO.js';
import { SearchRepository } from '../storage/postgres/SearchRepository.js';
import { ConfigService } from './ConfigService.js';
import { EmbeddingService } from './EmbeddingService.js';
import { SearchService } from './SearchService.js';

const hit = (id: string, demoted = false): SearchHitDTO => CommonUtils.buildModelStrict(SearchHitDTO, {
    id,
    kb: 'development',
    externalId: `raw/${id}.md`,
    anchor: `raw/${id}.md#fact`,
    title: id,
    heading: 'Fact',
    snippet: '…',
    date: null,
    url: null,
    metadata: {},
    demoted
});

const NO_FILTER = new Map<string, string[]>();

describe('SearchService', () => {
    let search: SearchService;
    let repository: SearchRepository;
    let embeddings: EmbeddingService;
    let dev: KnowledgeBaseConfig;

    const query = (overrides: Partial<Parameters<SearchService['search']>[0]> = {}): Parameters<SearchService['search']>[0] => ({
        question: 'why?',
        knowledgeBases: [dev],
        filter: NO_FILTER,
        limit: 10,
        ...overrides
    });

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        search = PlatformTest.get<SearchService>(SearchService);
        repository = PlatformTest.get<SearchRepository>(SearchRepository);
        embeddings = PlatformTest.get<EmbeddingService>(EmbeddingService);
        [dev] = PlatformTest.get<ConfigService>(ConfigService).config.knowledgeBases;

        vi.spyOn(embeddings, 'embedQuery').mockResolvedValue([1, 0, 0, 0]);
        vi.spyOn(repository, 'vector').mockResolvedValue(['v1', 'v2']);
        // The full-text leg finds f1 and v2; the leg for chunks without a vector finds none.
        vi.spyOn(repository, 'fullText').mockImplementation((_kbs, _question, _match, _filter, _limit, withoutVectorFor) =>
            Promise.resolve(CommonUtils.isUndefined(withoutVectorFor) ? ['f1', 'v2'] : []));
        vi.spyOn(repository, 'details').mockImplementation((ids) => Promise.resolve(ids.map((id) => hit(id))));
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('answers from the vector leg alone with the default weights, when every chunk has a vector', async () => {
        expect.assertions(6);

        const outcome = await search.search(query());

        expect(outcome.mode).toBe(SearchMode.Vector);
        expect(outcome.models).toEqual(['test-embed:v1']);
        expect(outcome.hits.map((scored) => scored.hit.id)).toEqual(['v1', 'v2']);
        expect(repository.vector).toHaveBeenCalledWith(['development'], expect.objectContaining({ name: 'test-embed:v1' }), [1, 0, 0, 0], NO_FILTER, 50);
        // Only the look for chunks the model has no vector for; the full-text leg itself does not run.
        expect(repository.fullText).toHaveBeenCalledTimes(1);
        expect(repository.fullText).toHaveBeenCalledWith(['development'], 'why?', FullTextMatch.Any, NO_FILTER, 50, 'test-embed:v1');
    });

    it('finds a chunk the model has no vector for yet through full-text, beside the vector leg', async () => {
        expect.assertions(2);

        // A deferred backlog: `pending` is stored and searchable, but not embedded.
        vi.mocked(repository.fullText).mockResolvedValue(['pending']);

        const outcome = await search.search(query());

        expect(outcome.mode).toBe(SearchMode.Hybrid);
        expect(outcome.hits.map((scored) => scored.hit.id)).toEqual(expect.arrayContaining(['v1', 'v2', 'pending']));
    });

    it('fuses the full-text leg in when it is weighted for the request', async () => {
        expect.assertions(3);

        const outcome = await search.search(query({ weights: { fullText: 1 } }));

        expect(outcome.mode).toBe(SearchMode.Hybrid);
        // v2 is in both lists, so it outranks the top of either one alone.
        expect(outcome.hits.map((scored) => scored.hit.id)).toEqual(['v2', 'v1', 'f1']);
        expect(repository.fullText).toHaveBeenCalledWith(['development'], 'why?', FullTextMatch.Any, NO_FILTER, 50);
    });

    it('answers from full-text when the question cannot be embedded', async () => {
        expect.assertions(4);

        vi.mocked(embeddings.embedQuery).mockRejectedValue(new Error('Ollama unreachable'));

        const outcome = await search.search(query());

        expect(outcome.mode).toBe(SearchMode.FullText);
        expect(outcome.models).toEqual([]);
        expect(outcome.hits.map((scored) => scored.hit.id)).toEqual(['f1', 'v2']);
        expect(repository.vector).not.toHaveBeenCalled();
    });

    it('answers a knowledge base without a model from full-text, beside the vector leg of the others', async () => {
        expect.assertions(3);

        const plain = { ...dev, id: 'plain', models: [] };

        const outcome = await search.search(query({ knowledgeBases: [dev, plain] }));

        expect(outcome.mode).toBe(SearchMode.Hybrid);
        expect(repository.vector).toHaveBeenCalledWith(['development'], expect.anything(), expect.anything(), NO_FILTER, 50);
        expect(repository.fullText).toHaveBeenCalledWith(['plain'], 'why?', FullTextMatch.Any, NO_FILTER, 50);
    });

    it('skips the embedder entirely when the vector leg is weighted out', async () => {
        expect.assertions(2);

        const outcome = await search.search(query({ weights: { vector: 0, fullText: 1 } }));

        expect(outcome.mode).toBe(SearchMode.FullText);
        expect(embeddings.embedQuery).not.toHaveBeenCalled();
    });

    it('ranks demoted documents last without dropping them, and keeps the fused order within each group', async () => {
        expect.assertions(1);

        vi.mocked(repository.vector).mockResolvedValue(['old', 'a', 'b']);
        vi.mocked(repository.details).mockResolvedValue([hit('old', true), hit('a'), hit('b')]);

        const outcome = await search.search(query());

        expect(outcome.hits.map((scored) => scored.hit.id)).toEqual(['a', 'b', 'old']);
    });

    it('demotes within the returned window, so a demoted best match is still returned, last', async () => {
        expect.assertions(2);

        // More candidates than the limit: demoting before the cut would push `old` out of the window.
        vi.mocked(repository.vector).mockResolvedValue(['old', 'a', 'b', 'c']);
        vi.mocked(repository.details).mockImplementation((ids) => Promise.resolve(ids.map((id) => hit(id, id === 'old'))));

        const outcome = await search.search(query({ limit: 2 }));

        expect(outcome.hits.map((scored) => scored.hit.id)).toEqual(['a', 'old']);
        // Snippets are built only for what is returned.
        expect(repository.details).toHaveBeenCalledWith(['old', 'a'], 'why?');
    });

    it('returns at most limit hits', async () => {
        expect.assertions(1);

        expect((await search.search(query({ limit: 1 }))).hits).toHaveLength(1);
    });

    it('drops a fused id whose chunk vanished before the details were read', async () => {
        expect.assertions(1);

        vi.mocked(repository.details).mockResolvedValue([hit('v2')]);

        expect((await search.search(query())).hits.map((scored) => scored.hit.id)).toEqual(['v2']);
    });

    it('rejects a model no searched knowledge base is embedded with', async () => {
        expect.assertions(1);

        await expect(search.search(query({ model: 'other:1b' }))).rejects.toThrow(BadRequest);
    });

    it('answers nothing for no readable knowledge base, without touching the database', async () => {
        expect.assertions(2);

        const outcome = await search.search(query({ knowledgeBases: [] }));

        expect(outcome).toEqual({ mode: SearchMode.FullText, models: [], hits: [] });
        expect(repository.details).not.toHaveBeenCalled();
    });
});
