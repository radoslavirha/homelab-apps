import { CommonUtils } from '@radoslavirha/utils';
import { HttpProviderService } from '@radoslavirha/tsed-http-provider';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
// registers the HttpProviderService override bound to this API's config
import '../../providers/HttpProviderProvider.js';
import { OllamaEmbedRequestDTO } from './dto/OllamaEmbedRequestDTO.js';
import { OllamaEmbedResponseDTO } from './dto/OllamaEmbedResponseDTO.js';
import { OllamaEndpoint } from './OllamaEndpoint.js';

describe('OllamaEndpoint', () => {
    let endpoint: OllamaEndpoint;
    let post: ReturnType<typeof vi.spyOn>;
    let searchPost: ReturnType<typeof vi.spyOn>;

    const request = (): OllamaEmbedRequestDTO => CommonUtils.buildModelStrict(OllamaEmbedRequestDTO, {
        model: 'm',
        input: ['x'],
        keepAlive: '1m',
        truncate: true
    });

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        const http = PlatformTest.get<HttpProviderService<ExternalApi>>(HttpProviderService);
        const reply = { model: 'm', embeddings: [[1, 2]], total_duration: 5 };

        post = vi.spyOn(http.get(ExternalApi.Ollama), 'post').mockResolvedValue(reply);
        searchPost = vi.spyOn(http.get(ExternalApi.OllamaSearch), 'post').mockResolvedValue(reply);
        endpoint = PlatformTest.get<OllamaEndpoint>(OllamaEndpoint);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('serializes the request to Ollama\'s wire names and deserializes the response', async () => {
        expect.assertions(3);

        const signal = new AbortController().signal;
        const response = await endpoint.embed(request(), signal);

        expect(post).toHaveBeenCalledWith('/api/embed', { model: 'm', input: ['x'], keep_alive: '1m', truncate: true }, { signal, retry: true });
        expect(response).toBeInstanceOf(OllamaEmbedResponseDTO);
        expect(response).toEqual(expect.objectContaining({ model: 'm', embeddings: [[1, 2]] }));
    });

    it('sends a question through the OLLAMA_SEARCH client, with its own budget', async () => {
        expect.assertions(3);

        const response = await endpoint.embedQuestion(request());

        expect(searchPost).toHaveBeenCalledWith('/api/embed', { model: 'm', input: ['x'], keep_alive: '1m', truncate: true }, { signal: undefined, retry: true });
        expect(post).not.toHaveBeenCalled();
        expect(response).toBeInstanceOf(OllamaEmbedResponseDTO);
    });
});
