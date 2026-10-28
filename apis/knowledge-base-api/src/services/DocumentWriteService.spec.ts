import type { BaseLogger } from '@radoslavirha/tsed-logger';
import { NotImplemented } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { RunStart } from '../models/RunStart.enum.js';
import { SourceAdapterFactory } from '../sources/SourceAdapterFactory.js';
import { SourceWriteRefusedError } from '../sources/SourceWriteRefusedError.js';
import type { SourceWriter } from '../sources/SourceWriter.js';
import { FakeSourceAdapter } from '../test/FakeSourceAdapter.js';
import { ConfigService } from './ConfigService.js';
import { DocumentWriteService } from './DocumentWriteService.js';
import { IndexingLoopService } from './IndexingLoopService.js';

const ID = 'work/2026-10-20-x/spec.md';
const PROVENANCE = { onBehalfOf: 'akadmin', subject: 'X' };

describe('DocumentWriteService', () => {
    let writes: DocumentWriteService;
    let loop: IndexingLoopService;
    let kb: KnowledgeBaseConfig;
    let writer: { [K in keyof SourceWriter]: Mock<SourceWriter[K]> };

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        writes = PlatformTest.get<DocumentWriteService>(DocumentWriteService);
        loop = PlatformTest.get<IndexingLoopService>(IndexingLoopService);
        [kb] = PlatformTest.get<ConfigService>(ConfigService).config.knowledgeBases;
        writer = { read: vi.fn(), write: vi.fn(), delete: vi.fn() };

        const adapter = new FakeSourceAdapter();

        vi.spyOn(PlatformTest.get<SourceAdapterFactory>(SourceAdapterFactory), 'get').mockReturnValue(Object.assign(adapter, { writer }));
        vi.spyOn(loop, 'trigger').mockResolvedValue(RunStart.Started);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('commitMessage', () => {
        it('is the subject, then the trailers', () => {
            expect(writes.commitMessage(PROVENANCE)).toBe('kb: X\n\nOn-behalf-of: akadmin\nVia: knowledge-base MCP');
        });

        it('puts a body between them, and the reason on one line among the trailers', () => {
            expect(writes.commitMessage({ ...PROVENANCE, subject: 'delete\nX', body: ' Why.\n\nMore. ', reason: 'Merged\ninto Y.' })).toBe(
                'kb: delete X\n\nWhy.\n\nMore.\n\nOn-behalf-of: akadmin\nVia: knowledge-base MCP\nReason: Merged into Y.'
            );
        });
    });

    it('answers 501 for a source that has no writer', () => {
        vi.mocked(PlatformTest.get<SourceAdapterFactory>(SourceAdapterFactory).get).mockReturnValue(new FakeSourceAdapter());

        expect(() => writes.write(kb, ID, '# X\n', null, PROVENANCE)).toThrow(NotImplemented);
        expect(() => writes.delete(kb, ID, 'blob', PROVENANCE)).toThrow(NotImplemented);
    });

    it('reads through the source\'s writer', async () => {
        expect.assertions(1);

        writer.read.mockResolvedValue(null);

        expect(await writes.read(kb, ID)).toBeNull();
    });

    it('passes a failure that is not a refusal on, reading nothing and starting no run', async () => {
        expect.assertions(3);

        writer.write.mockRejectedValue(new Error('GitHub is down'));

        await expect(writes.write(kb, ID, '# X\n', 'blob', PROVENANCE)).rejects.toThrow('GitHub is down');
        expect(writer.read).not.toHaveBeenCalled();
        expect(loop.trigger).not.toHaveBeenCalled();
    });

    it('runs the next write after one that failed', async () => {
        expect.assertions(2);

        writer.write.mockRejectedValueOnce(new SourceWriteRefusedError(ID)).mockResolvedValueOnce({ version: 'b2', commit: 'c2' });
        writer.read.mockResolvedValue({ content: '# Theirs\n', version: 'b1' });

        const [refused, written] = await Promise.allSettled([
            writes.write(kb, ID, '# X\n', null, PROVENANCE),
            writes.write(kb, 'work/2026-10-20-y/spec.md', '# Y\n', null, PROVENANCE)
        ]);

        expect(refused).toMatchObject({ status: 'rejected', reason: { status: 409, errors: [{ name: 'CURRENT', content: '# Theirs\n', version: 'b1' }] } });
        expect(written).toEqual({ status: 'fulfilled', value: { version: 'b2', commit: 'c2' } });
    });

    describe('a refused write at a stale version', () => {
        beforeEach(() => {
            writer.read.mockResolvedValue({ content: '# Theirs\n', version: 'b1' });
        });

        it('tells a rewrite to apply its change to the current document', async () => {
            expect.assertions(1);

            writer.write.mockRejectedValue(new SourceWriteRefusedError(ID));

            await expect(writes.write(kb, ID, '# X\n', 'b0', PROVENANCE)).rejects.toMatchObject({
                status: 409,
                message: `${ID} has changed since version b0. Apply your change to the current document and write it with its version.`
            });
        });

        it('tells a delete to show the current document, not to write it', async () => {
            expect.assertions(1);

            writer.delete.mockRejectedValue(new SourceWriteRefusedError(ID));

            await expect(writes.delete(kb, ID, 'b0', PROVENANCE)).rejects.toMatchObject({
                status: 409,
                message: `${ID} has changed since version b0. Show the current document, and delete it with its version only if it should still go.`,
                errors: [{ name: 'CURRENT', content: '# Theirs\n', version: 'b1' }]
            });
        });
    });

    it('starts an incremental run for the knowledge base after a delete, and only logs when it cannot', async () => {
        expect.assertions(3);

        const warn = vi.spyOn((writes as unknown as { log: BaseLogger }).log, 'warn');

        writer.delete.mockResolvedValue({ commit: 'c1' });
        vi.mocked(loop.trigger).mockRejectedValue(new Error('database down'));

        expect(await writes.delete(kb, ID, 'blob', PROVENANCE)).toEqual({ commit: 'c1' });
        expect(loop.trigger).toHaveBeenCalledWith({ knowledgeBases: ['development'], full: false, manual: false });
        await expect.poll(() => warn.mock.calls[0]?.[1]).toMatchObject({ event: 'DOCUMENT_WRITE_INDEX_FAILED', error: 'database down' });
    });
});
