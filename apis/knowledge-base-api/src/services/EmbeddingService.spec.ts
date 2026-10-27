import { CommonUtils } from '@radoslavirha/utils';
import { BadGateway } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaEmbedRequestDTO } from '../endpoints/ollama/dto/OllamaEmbedRequestDTO.js';
import { OllamaEmbedResponseDTO } from '../endpoints/ollama/dto/OllamaEmbedResponseDTO.js';
import { OllamaEndpoint } from '../endpoints/ollama/OllamaEndpoint.js';
import type { EmbeddingModelConfig } from '../models/config/EmbeddingsConfig.js';
import { EmbeddingService } from './EmbeddingService.js';

/** `config/test.json`'s model, with embeddinggemma's templates. */
const MODEL: EmbeddingModelConfig = {
    name: 'test-embed:v1',
    dimensions: 4,
    documentTemplate: 'title: {title} | text: {text}',
    queryTemplate: 'task: search result | query: {query}'
};

const response = (count: number, dimensions = 4): OllamaEmbedResponseDTO => CommonUtils.buildModelStrict(OllamaEmbedResponseDTO, {
    model: MODEL.name,
    embeddings: Array.from({ length: count }, () => new Array<number>(dimensions).fill(0.5))
});

describe('EmbeddingService', () => {
    let service: EmbeddingService;
    let ollama: OllamaEndpoint;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<EmbeddingService>(EmbeddingService);
        ollama = PlatformTest.get<OllamaEndpoint>(OllamaEndpoint);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('templates', () => {
        it('sends a chunk as title, heading path and body', () => {
            expect(EmbeddingService.documentInput(MODEL, { title: 'Spec', heading: 'Decisions › 1', body: 'Body' }))
                .toBe('title: Spec | text: Decisions › 1\n\nBody');
        });

        it('says "none" for a document without a title, as the model card prescribes', () => {
            expect(EmbeddingService.documentInput(MODEL, { title: null, heading: '', body: 'Body' })).toBe('title: none | text: Body');
        });

        it('does not expand a placeholder that appears inside the title', () => {
            expect(EmbeddingService.documentInput(MODEL, { title: '{text}', heading: '', body: 'b' })).toBe('title: {text} | text: b');
        });

        it('wraps a question in the query template', () => {
            expect(EmbeddingService.queryInput(MODEL, 'why?')).toBe('task: search result | query: why?');
        });
    });

    it('embeds documents in one call with the model, keep_alive and truncation, cancellable by the run', async () => {
        expect.assertions(4);

        const embed = vi.spyOn(ollama, 'embed').mockResolvedValue(response(2));
        const { signal } = new AbortController();

        const vectors = await service.embedDocuments(MODEL, [
            { title: 'a', heading: '', body: 'configmap' },
            { title: 'b', heading: '', body: 'traefik' }
        ], signal);

        expect(vectors).toHaveLength(2);
        expect(embed.mock.calls[0][1]).toBe(signal);
        expect(embed.mock.calls[0][0]).toBeInstanceOf(OllamaEmbedRequestDTO);
        expect(embed.mock.calls[0][0]).toMatchObject({
            model: 'test-embed:v1',
            input: ['title: a | text: configmap', 'title: b | text: traefik'],
            keepAlive: '1m',
            truncate: true
        });
    });

    it('embeds a question through the search budget, not the indexing one', async () => {
        expect.assertions(3);

        const embed = vi.spyOn(ollama, 'embed');
        const embedQuestion = vi.spyOn(ollama, 'embedQuestion').mockResolvedValue(response(1));

        await expect(service.embedQuery(MODEL, 'why?')).resolves.toHaveLength(4);
        expect(embedQuestion.mock.calls[0][0]).toMatchObject({ input: ['task: search result | query: why?'] });
        expect(embed).not.toHaveBeenCalled();
    });

    it('fails with the fix in the message when the model returns another dimension', async () => {
        expect.assertions(1);

        vi.spyOn(ollama, 'embedQuestion').mockResolvedValue(response(1, 768));

        await expect(service.embedQuery(MODEL, 'q')).rejects.toThrow(
            new BadGateway('Model test-embed:v1 returned 768 dimensions; embeddings.models declares 4.')
        );
    });

    it('fails when Ollama returns fewer vectors than inputs', async () => {
        expect.assertions(1);

        vi.spyOn(ollama, 'embedQuestion').mockResolvedValue(response(0));

        await expect(service.embedQuery(MODEL, 'q')).rejects.toThrow(new BadGateway('Ollama returned 0 vectors for 1 inputs.'));
    });

    it('finds a configured model by name', () => {
        expect(service.model('test-embed:v1')).toMatchObject({ name: 'test-embed:v1', dimensions: 4 });
        expect(service.model('missing')).toBeUndefined();
    });
});
