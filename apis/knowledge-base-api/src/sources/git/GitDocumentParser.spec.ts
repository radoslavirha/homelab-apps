import { Serializer } from '@radoslavirha/tsed-common';
import type { BaseLogger } from '@radoslavirha/tsed-logger';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import { ChunkingMode } from '../../models/ChunkingMode.enum.js';
import { GitDocumentParser } from './GitDocumentParser.js';

const REPOSITORY = Serializer.deserialize({
    name: 'kb',
    owner: { login: 'someone' },
    default_branch: 'main',
    html_url: 'https://github.test/someone/kb'
}, GitHubRepositoryDTO);

describe('GitDocumentParser', () => {
    let parser: GitDocumentParser;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        parser = PlatformTest.get<GitDocumentParser>(GitDocumentParser);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('takes metadata from the frontmatter and the area from the first path segment', () => {
        const document = parser.parse('raw/a.md', '---\ntype: decision\nrepos: [homelab]\n---\n# A\n', 'b1', 'c1', REPOSITORY);

        expect(document.metadata).toEqual({ type: 'decision', repos: ['homelab'], area: 'raw' });
        expect(document).toEqual(expect.objectContaining({ externalId: 'raw/a.md', version: 'b1', content: '---\ntype: decision\nrepos: [homelab]\n---\n# A\n' }));
    });

    it('names the source repository of a mirrored document in repos', () => {
        expect(parser.parse('mirror/homelab/docs/a.md', '# A', 'b1', 'c1', REPOSITORY).metadata).toEqual({ area: 'mirror', repos: ['homelab'] });
    });

    it('titles a document by its H1, else a title field, else its file name', () => {
        expect(parser.parse('raw/a.md', '---\ntitle: Field\n---\n# Heading\n', 'b1', 'c1', REPOSITORY).title).toBe('Heading');
        expect(parser.parse('raw/a.md', '---\ntitle: Field\n---\ntext\n', 'b1', 'c1', REPOSITORY).title).toBe('Field');
        expect(parser.parse('raw/some-note.md', 'text', 'b1', 'c1', REPOSITORY).title).toBe('some-note');
    });

    it('dates a note by date and a spec by created, and ignores a date that is not a calendar date', () => {
        expect(parser.parse('raw/a.md', '---\ndate: 2026-01-01\n---\n', 'b1', 'c1', REPOSITORY).date).toBe('2026-01-01');
        expect(parser.parse('work/a/spec.md', '---\ncreated: 2026-01-02\n---\n', 'b1', 'c1', REPOSITORY).date).toBe('2026-01-02');
        expect(parser.parse('raw/a.md', '---\ndate: 2026-02-30\n---\n', 'b1', 'c1', REPOSITORY).date).toBeNull();
    });

    it('links to the file at the indexed commit, path segments encoded', () => {
        expect(parser.parse('raw/a b#c.md', 'x', 'b1', 'abc', REPOSITORY).url).toBe('https://github.test/someone/kb/blob/abc/raw/a%20b%23c.md');
    });

    it('asks for one chunk per entry for a docs history', () => {
        expect(parser.parse('mirror/homelab/_history.md', '# h', 'b1', 'c1', REPOSITORY).chunking).toBe(ChunkingMode.Entries);
        expect(parser.parse('raw/a.md', '# a', 'b1', 'c1', REPOSITORY).chunking).toBeUndefined();
    });

    it('indexes a document with a broken header without its metadata, and says so', () => {
        const warn = vi.spyOn((parser as unknown as { log: BaseLogger }).log, 'warn');
        const document = parser.parse('raw/a.md', '---\nrepos: [unclosed\n---\n# A\n', 'b1', 'c1', REPOSITORY);

        expect(document.metadata).toEqual({ area: 'raw' });
        expect(warn).toHaveBeenCalledWith('Frontmatter ignored.', expect.objectContaining({ path: 'raw/a.md' }));
    });
});
