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

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        const client = PlatformTest.get<HttpProviderService<ExternalApi>>(HttpProviderService).get(ExternalApi.Ollama);

        post = vi.spyOn(client, 'post').mockResolvedValue({ model: 'm', embeddings: [[1, 2]], total_duration: 5 });
        endpoint = PlatformTest.get<OllamaEndpoint>(OllamaEndpoint);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('serializes the request to Ollama\'s wire names and deserializes the response', async () => {
        expect.assertions(3);

        const signal = new AbortController().signal;
        const response = await endpoint.embed(CommonUtils.buildModelStrict(OllamaEmbedRequestDTO, {
            model: 'm',
            input: ['x'],
            keepAlive: '1m',
            truncate: true
        }), signal);

        expect(post).toHaveBeenCalledWith('/api/embed', { model: 'm', input: ['x'], keep_alive: '1m', truncate: true }, { signal });
        expect(response).toBeInstanceOf(OllamaEmbedResponseDTO);
        expect(response).toEqual(expect.objectContaining({ model: 'm', embeddings: [[1, 2]] }));
    });
});
