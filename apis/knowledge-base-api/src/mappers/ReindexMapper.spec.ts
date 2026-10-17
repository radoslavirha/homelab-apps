import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReindexPostResponse } from '../models/ReindexPostResponse.js';
import { ReindexState } from '../models/ReindexState.enum.js';
import { RunStart } from '../models/RunStart.enum.js';
import { ReindexMapper } from './ReindexMapper.js';

describe('ReindexMapper', () => {
    let mapper: ReindexMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<ReindexMapper>(ReindexMapper);
    });
    afterEach(PlatformTest.reset);

    it('maps a started run to the response model, the id list copied rather than shared', () => {
        const knowledgeBases = ['dev'];
        const response = mapper.toResponse(knowledgeBases, true, RunStart.Started);

        expect(response).toBeInstanceOf(ReindexPostResponse);
        expect(response).toEqual(expect.objectContaining({ knowledgeBases: ['dev'], full: true, state: ReindexState.Started }));
        expect(response.knowledgeBases).not.toBe(knowledgeBases);
    });

    it('maps a queued run to QUEUED', () => {
        expect(mapper.toResponse(['dev'], false, RunStart.Queued).state).toBe(ReindexState.Queued);
    });
});
