import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { ConventionsGetResponse } from '../models/ConventionsGetResponse.js';
import { ConfigService } from '../services/ConfigService.js';
import { ConventionsMapper } from './ConventionsMapper.js';

describe('ConventionsMapper', () => {
    let mapper: ConventionsMapper;
    let kb: KnowledgeBaseConfig;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<ConventionsMapper>(ConventionsMapper);
        [kb] = PlatformTest.get<ConfigService>(ConfigService).config.knowledgeBases;
    });
    afterEach(PlatformTest.reset);

    it('maps the file read from the source', () => {
        const response = mapper.toResponse(kb, { path: 'README.md', content: '# Rules\n', version: 'blob' });

        expect(response).toBeInstanceOf(ConventionsGetResponse);
        expect(response).toEqual({ kb: 'development', path: 'README.md', markdown: '# Rules\n', version: 'blob' });
    });

    it('maps "names none" to nulls', () => {
        expect(mapper.toResponse(kb, null)).toEqual({ kb: 'development', path: null, markdown: null, version: null });
    });
});
