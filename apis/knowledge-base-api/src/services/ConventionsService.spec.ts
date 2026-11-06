import { PlatformTest } from '@tsed/platform-http/testing';
import { InternalServerError, NotImplemented } from '@tsed/exceptions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import type { SourceAdapter } from '../sources/SourceAdapter.js';
import { SourceAdapterFactory } from '../sources/SourceAdapterFactory.js';
import { ConfigService } from './ConfigService.js';
import { ConventionsService } from './ConventionsService.js';

describe('ConventionsService', () => {
    let service: ConventionsService;
    let sources: SourceAdapterFactory;
    let kb: KnowledgeBaseConfig;

    const source = (file?: SourceAdapter['file']): SourceAdapter => ({
        changes: () => Promise.reject(new Error('not read here')),
        ...(file === undefined ? {} : { file })
    });

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<ConventionsService>(ConventionsService);
        sources = PlatformTest.get<SourceAdapterFactory>(SourceAdapterFactory);
        [kb] = PlatformTest.get<ConfigService>(ConfigService).config.knowledgeBases;
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('reads the configured path from the source, live', async () => {
        expect.assertions(2);

        const file = vi.fn<NonNullable<SourceAdapter['file']>>().mockResolvedValue({ content: '# Rules\n', version: 'blob' });

        vi.spyOn(sources, 'get').mockReturnValue(source(file));

        expect(await service.read(kb)).toEqual({ path: 'README.md', content: '# Rules\n', version: 'blob' });
        expect(file).toHaveBeenCalledWith('README.md');
    });

    it('is null, without touching the source, when the knowledge base names no file', async () => {
        expect.assertions(2);

        const get = vi.spyOn(sources, 'get');

        expect(await service.read({ ...kb, conventionsPath: undefined })).toBeNull();
        expect(get).not.toHaveBeenCalled();
    });

    it('fails when the named file is missing: a configuration mistake, not "none"', async () => {
        expect.assertions(1);

        vi.spyOn(sources, 'get').mockReturnValue(source(() => Promise.resolve(null)));

        await expect(service.read(kb)).rejects.toBeInstanceOf(InternalServerError);
    });

    it('answers 501 for a source that cannot read single files', async () => {
        expect.assertions(1);

        vi.spyOn(sources, 'get').mockReturnValue(source());

        await expect(service.read(kb)).rejects.toBeInstanceOf(NotImplemented);
    });
});
