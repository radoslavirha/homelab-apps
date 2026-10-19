import { Serializer } from '@radoslavirha/tsed-common';
import { Logger } from '@radoslavirha/tsed-logger';
import { PlatformTest } from '@tsed/platform-http/testing';
import { RequestError } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubBlobDTO } from '../../endpoints/github/dto/GitHubBlobDTO.js';
import { GitHubBranchDTO } from '../../endpoints/github/dto/GitHubBranchDTO.js';
import { GitHubCompareDTO } from '../../endpoints/github/dto/GitHubCompareDTO.js';
import { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import { GitHubTreeDTO } from '../../endpoints/github/dto/GitHubTreeDTO.js';
import { GitHubEndpoint } from '../../endpoints/github/GitHubEndpoint.js';
import { ChunkingMode } from '../../models/ChunkingMode.enum.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import { ConfigService } from '../../services/ConfigService.js';
import { GitDocumentParser } from './GitDocumentParser.js';
import { GitHubRepositoryService } from './GitHubRepositoryService.js';
import { GITHUB_COMPARE_FILE_LIMIT, GitSourceAdapter } from './GitSourceAdapter.js';

/** The wire shapes GitHub sends, deserialized the way the endpoint does it. */
const REPOSITORY = Serializer.deserialize({
    name: 'kb',
    owner: { login: 'someone' },
    default_branch: 'main',
    html_url: 'https://github.test/someone/kb'
}, GitHubRepositoryDTO);

const branch = (sha: string): GitHubBranchDTO => Serializer.deserialize({ name: 'main', commit: { sha } }, GitHubBranchDTO);

const compare = (body: object): GitHubCompareDTO => Serializer.deserialize({ status: 'ahead', files: [], ...body }, GitHubCompareDTO);

const notFound = (): RequestError => new RequestError('Not Found', 404, { request: { method: 'GET', url: 'x', headers: {} } });

const BLOBS: Record<string, string> = {
    'sha-note': '---\ndate: 2026-10-13\ntype: decision\nrepos: [homelab]\n---\n\n# A note\n\n## Decision\n\nYes.\n',
    'sha-spec': '---\nstatus: draft\ncreated: 2026-10-14\n---\n# A spec\n',
    'sha-mirror': '# Architecture\n',
    'sha-history': '# history\n\n## entry\n'
};

const TREE = Serializer.deserialize({
    sha: 'head',
    truncated: false,
    tree: [
        { path: 'raw', type: 'tree', sha: 'sha-dir' },
        { path: 'README.md', type: 'blob', sha: 'sha-readme' },
        { path: 'raw/2026-01-09-note.md', type: 'blob', sha: 'sha-note' },
        { path: 'work/2026-01-10-x/spec.md', type: 'blob', sha: 'sha-spec' },
        { path: 'mirror/homelab/docs/architecture.md', type: 'blob', sha: 'sha-mirror' },
        { path: 'mirror/homelab/_history.md', type: 'blob', sha: 'sha-history' },
        { path: 'mirror/iot-esphome/relays.yaml', type: 'blob', sha: 'sha-yaml' },
        { path: 'mirror/vendor', type: 'commit', sha: 'sha-submodule' }
    ]
}, GitHubTreeDTO);

describe('GitSourceAdapter', () => {
    let github: GitHubEndpoint;
    let repositories: GitHubRepositoryService;
    let kb: GitKnowledgeBaseConfig;

    const adapter = (config: GitKnowledgeBaseConfig = kb): GitSourceAdapter => new GitSourceAdapter(
        config,
        repositories,
        github,
        PlatformTest.get<GitDocumentParser>(GitDocumentParser),
        2,
        PlatformTest.get<Logger>(Logger).child('GIT_SOURCE')
    );

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        github = PlatformTest.get<GitHubEndpoint>(GitHubEndpoint);
        repositories = PlatformTest.get<GitHubRepositoryService>(GitHubRepositoryService);
        [kb] = PlatformTest.get<ConfigService>(ConfigService).config.knowledgeBases;

        vi.spyOn(repositories, 'repository').mockResolvedValue(REPOSITORY);
        vi.spyOn(github, 'getBranch').mockResolvedValue(branch('head'));
        vi.spyOn(github, 'getTree').mockResolvedValue(TREE);
        vi.spyOn(github, 'getBlob').mockImplementation((_repo, sha) => Promise.resolve(Serializer.deserialize({
            sha,
            content: Buffer.from(BLOBS[sha] ?? '').toString('base64'),
            encoding: 'base64'
        }, GitHubBlobDTO)));
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('first run', () => {
        it('lists the whole tree at the branch tip and reports a complete snapshot of the included files', async () => {
            expect.assertions(4);

            const changes = await adapter().changes(null);

            expect(github.getBranch).toHaveBeenCalledWith(REPOSITORY, 'main', undefined);
            expect(changes.complete).toBe(true);
            expect(changes.cursor).toBe('head');
            expect(changes.upserts.map((document) => document.externalId)).toEqual([
                'raw/2026-01-09-note.md',
                'work/2026-01-10-x/spec.md',
                'mirror/homelab/docs/architecture.md',
                'mirror/homelab/_history.md'
            ]);
        });

        it('builds documents with metadata, title, date and a link to the indexed commit', async () => {
            expect.assertions(5);

            const { upserts } = await adapter().changes(null);
            const [note, spec, mirror, history] = upserts;

            expect(note).toMatchObject({
                title: 'A note',
                date: '2026-10-13',
                url: 'https://github.test/someone/kb/blob/head/raw/2026-01-09-note.md',
                version: 'head',
                metadata: { area: 'raw', type: 'decision', repos: ['homelab'], date: '2026-10-13' }
            });
            expect(note.chunking).toBeUndefined();
            expect(spec).toMatchObject({ title: 'A spec', date: '2026-10-14', metadata: { area: 'work', status: 'draft' } });
            expect(mirror).toMatchObject({ title: 'Architecture', date: null, metadata: { area: 'mirror', repos: ['homelab'] } });
            expect(history.chunking).toBe(ChunkingMode.Entries);
        });

        it('refuses a truncated tree rather than indexing part of it as complete', async () => {
            expect.assertions(1);

            vi.spyOn(github, 'getTree').mockResolvedValue(Serializer.deserialize({ sha: 'head', truncated: true, tree: [] }, GitHubTreeDTO));

            await expect(adapter().changes(null)).rejects.toThrow(/truncated/);
        });

        it('starts no further file reads once one read has failed', async () => {
            expect.assertions(2);

            vi.mocked(github.getBlob).mockImplementationOnce(() => Promise.reject(new RequestError('Server Error', 502, { request: { method: 'GET', url: 'x', headers: {} } })));

            await expect(adapter().changes(null)).rejects.toThrow('Server Error');
            // Let any worker still running finish what it would do next.
            await new Promise((resolve) => setTimeout(resolve, 20));
            // Two workers: the failed read and at most one other already in flight.
            expect(vi.mocked(github.getBlob).mock.calls.length).toBeLessThanOrEqual(2);
        });

        it('uses the configured branch when one is set', async () => {
            expect.assertions(1);

            await adapter({ ...kb, git: { ...kb.git, branch: 'next' } }).changes('head');

            expect(github.getBranch).toHaveBeenCalledWith(REPOSITORY, 'next', undefined);
        });
    });

    describe('later runs', () => {
        it('reports nothing when the branch has not moved', async () => {
            expect.assertions(1);

            const compareSpy = vi.spyOn(github, 'compare');

            await adapter().changes('head');

            expect(compareSpy).not.toHaveBeenCalled();
        });

        it('fetches added and modified files, deletes removed ones, and handles a rename as both', async () => {
            expect.assertions(4);

            vi.spyOn(github, 'compare').mockResolvedValue(compare({
                files: [
                    { filename: 'raw/2026-01-09-note.md', status: 'added', sha: 'sha-note' },
                    { filename: 'work/2026-01-10-x/spec.md', status: 'modified', sha: 'sha-spec' },
                    { filename: 'raw/gone.md', status: 'removed', sha: 'sha-gone' },
                    {
                        filename: 'mirror/homelab/docs/architecture.md',
                        status: 'renamed',
                        sha: 'sha-mirror',
                        previous_filename: 'mirror/homelab/docs/old.md'
                    },
                    { filename: 'README.md', status: 'modified', sha: 'sha-readme' },
                    { filename: 'raw/submodule.md', status: 'added', sha: null }
                ]
            }));

            const changes = await adapter().changes('base');

            expect(github.compare).toHaveBeenCalledWith(REPOSITORY, 'base', 'head', undefined);
            expect(changes.complete).toBe(false);
            expect(changes.upserts.map((document) => document.externalId)).toEqual([
                'raw/2026-01-09-note.md',
                'work/2026-01-10-x/spec.md',
                'mirror/homelab/docs/architecture.md'
            ]);
            expect(changes.deletes).toEqual(['raw/gone.md', 'mirror/homelab/docs/old.md']);
        });

        it('falls back to a complete listing when the indexed commit no longer exists', async () => {
            expect.assertions(1);

            vi.spyOn(github, 'compare').mockRejectedValue(notFound());

            expect((await adapter().changes('force-pushed-away')).complete).toBe(true);
        });

        it.each(['diverged', 'behind'])('falls back to a complete listing when history is %s', async (status) => {
            expect.assertions(1);

            vi.spyOn(github, 'compare').mockResolvedValue(compare({ status }));

            expect((await adapter().changes('base')).complete).toBe(true);
        });

        it('falls back to a complete listing when the comparison may be cut off at GitHub\'s file limit', async () => {
            expect.assertions(1);

            vi.spyOn(github, 'compare').mockResolvedValue(compare({
                files: Array.from({ length: GITHUB_COMPARE_FILE_LIMIT }, (_, i) => ({ filename: `raw/${i}.md`, status: 'added', sha: 'sha-note' }))
            }));

            expect((await adapter().changes('base')).complete).toBe(true);
        });

        it('passes on other GitHub errors and forgets the repository so the next run looks it up again', async () => {
            expect.assertions(2);

            const forget = vi.spyOn(repositories, 'forget');

            vi.spyOn(github, 'compare').mockRejectedValue(new RequestError('Server Error', 500, { request: { method: 'GET', url: 'x', headers: {} } }));

            await expect(adapter().changes('base')).rejects.toThrow('Server Error');
            expect(forget).toHaveBeenCalled();
        });
    });

    describe('a run that is stopped', () => {
        it('hands its signal to every GitHub call', async () => {
            expect.assertions(4);

            const stop = new AbortController();
            const { signal } = stop;

            await adapter().changes(null, signal);

            expect(github.getBranch).toHaveBeenCalledWith(REPOSITORY, 'main', signal);
            expect(github.getTree).toHaveBeenCalledWith(REPOSITORY, 'head', signal);
            // Blob reads get a signal derived from the run's, so they stop with it.
            const blobSignal = vi.mocked(github.getBlob).mock.calls[0][2];

            expect(blobSignal?.aborted).toBe(false);

            stop.abort();

            expect(blobSignal?.aborted).toBe(true);
        });

        it('stops fetching files once aborted, and throws the reason', async () => {
            expect.assertions(2);

            const stop = new AbortController();
            const reason = new DOMException('The pod is shutting down.', 'AbortError');

            // The first file read stops the run; nothing after it is fetched.
            vi.mocked(github.getBlob).mockImplementationOnce(() => {
                stop.abort(reason);

                return Promise.reject(reason);
            });

            await expect(adapter().changes(null, stop.signal)).rejects.toBe(reason);
            // Two workers: each had at most one read in flight when the run stopped.
            expect(vi.mocked(github.getBlob).mock.calls.length).toBeLessThanOrEqual(2);
        });
    });
});
