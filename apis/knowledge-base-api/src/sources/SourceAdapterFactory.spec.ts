import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '../services/ConfigService.js';
import { GitSourceAdapter } from './git/GitSourceAdapter.js';
import { SourceAdapterFactory } from './SourceAdapterFactory.js';

describe('SourceAdapterFactory', () => {
    let sources: SourceAdapterFactory;
    let configService: ConfigService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        sources = PlatformTest.get<SourceAdapterFactory>(SourceAdapterFactory);
        configService = PlatformTest.get<ConfigService>(ConfigService);
    });
    afterEach(PlatformTest.reset);

    it('gives a git knowledge base the git adapter', () => {
        const [dev] = configService.config.knowledgeBases;

        expect(sources.get(dev)).toBeInstanceOf(GitSourceAdapter);
    });

    it('keeps one adapter per knowledge base', () => {
        const [dev] = configService.config.knowledgeBases;

        expect(sources.get(dev)).toBe(sources.get(dev));
        expect(sources.get(dev)).not.toBe(sources.get({ ...dev, id: 'other' }));
    });
});
