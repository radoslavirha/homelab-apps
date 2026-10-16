import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReindexPostResponse } from '../models/ReindexPostResponse.js';
import { ReindexMapper } from './ReindexMapper.js';

describe('ReindexMapper', () => {
    let mapper: ReindexMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<ReindexMapper>(ReindexMapper);
    });
    afterEach(PlatformTest.reset);

    it('maps a run to the response model, the id list copied rather than shared', () => {
        const knowledgeBases = ['dev'];
        const response = mapper.toResponse(knowledgeBases, true, false);

        expect(response).toBeInstanceOf(ReindexPostResponse);
        expect(response).toEqual(expect.objectContaining({ knowledgeBases: ['dev'], full: true, queued: false }));
        expect(response.knowledgeBases).not.toBe(knowledgeBases);
    });
});
