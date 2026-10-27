import { Serializer } from '@radoslavirha/tsed-common';
import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import { Octokit, RequestError } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubBlobDTO } from './dto/GitHubBlobDTO.js';
import { GitHubBranchDTO } from './dto/GitHubBranchDTO.js';
import { GitHubCompareDTO } from './dto/GitHubCompareDTO.js';
import { GitHubCompareStatusDTO } from './dto/GitHubCompareStatusDTO.enum.js';
import { GitHubContentCommitDTO } from './dto/GitHubContentCommitDTO.js';
import { GitHubContentDeleteRequestDTO } from './dto/GitHubContentDeleteRequestDTO.js';
import { GitHubContentDTO } from './dto/GitHubContentDTO.js';
import { GitHubContentPutRequestDTO } from './dto/GitHubContentPutRequestDTO.js';
import { GitHubContentTypeDTO } from './dto/GitHubContentTypeDTO.enum.js';
import { GitHubFileStatusDTO } from './dto/GitHubFileStatusDTO.enum.js';
import { GitHubRepositoryDTO } from './dto/GitHubRepositoryDTO.js';
import { GitHubTreeDTO } from './dto/GitHubTreeDTO.js';
import { GitHubTreeEntryTypeDTO } from './dto/GitHubTreeEntryTypeDTO.enum.js';
import { GitHubEndpoint, isGitHubWriteRefusal } from './GitHubEndpoint.js';

const octokit = {
    rest: {
        repos: { getBranch: vi.fn(), compareCommitsWithBasehead: vi.fn(), getContent: vi.fn(), createOrUpdateFileContents: vi.fn(), deleteFile: vi.fn() },
        git: { getTree: vi.fn(), getBlob: vi.fn() }
    }
};
const appOptions: unknown[] = [];
const INSTALLED = { owner: { login: 'someone', id: 1 }, name: 'kb', default_branch: 'main', html_url: 'https://github.test/someone/kb', private: true };

vi.mock('octokit', async (importOriginal) => {
    const original = await importOriginal<typeof import('octokit')>();

    return {
        ...original,
        App: vi.fn().mockImplementation(function (options: unknown) {
            appOptions.push(options);

            return {
                eachRepository: {
                    iterator: async function* () {
                        yield { octokit, repository: INSTALLED };
                    }
                }
            };
        })
    };
});

const requestError = (status: number): RequestError => new RequestError('x', status, { request: { method: 'PUT', url: 'x', headers: {} } });

describe('isGitHubWriteRefusal', () => {
    it('is a 404, 409 or 422 from GitHub, nothing else', () => {
        expect([404, 409, 422].map((status) => isGitHubWriteRefusal(requestError(status)))).toEqual([true, true, true]);
        expect(isGitHubWriteRefusal(requestError(500))).toBe(false);
        expect(isGitHubWriteRefusal(new Error('network'))).toBe(false);
    });
});

describe('GitHubEndpoint', () => {
    let github: GitHubEndpoint;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        vi.clearAllMocks();
        appOptions.length = 0;
        github = PlatformTest.get<GitHubEndpoint>(GitHubEndpoint);
    });
    afterEach(PlatformTest.reset);

    it('signs as the App with the configured client ID and key', async () => {
        expect.assertions(1);

        await github.listRepositories();

        expect(appOptions[0]).toMatchObject({ appId: 'Iv-test-client-id', privateKey: 'not-a-real-key' });
    });

    it('gives every request of the App a per-attempt deadline through its fetch', async () => {
        expect.assertions(1);

        const defaults = vi.spyOn(Octokit, 'defaults');

        await github.listRepositories();

        expect(defaults).toHaveBeenCalledWith(expect.objectContaining({ request: { fetch: expect.any(Function) } }));
    });

    it('deserializes the repositories the installations can read', async () => {
        expect.assertions(2);

        const [repository] = await github.listRepositories();

        expect(repository).toBeInstanceOf(GitHubRepositoryDTO);
        expect(repository).toMatchObject({ name: 'kb', owner: { login: 'someone' }, defaultBranch: 'main', htmlUrl: 'https://github.test/someone/kb' });
    });

    it('refuses to call a repository it has not listed', async () => {
        expect.assertions(1);

        const unlisted = Serializer.deserialize({ ...INSTALLED, name: 'other' }, GitHubRepositoryDTO);

        await expect(github.getBranch(unlisted, 'main')).rejects.toThrow(/list repositories first/);
    });

    describe('after listing', () => {
        let repository: GitHubRepositoryDTO;

        beforeEach(async () => {
            [repository] = await github.listRepositories();
        });

        it('reads a branch', async () => {
            expect.assertions(3);

            octokit.rest.repos.getBranch.mockResolvedValue({ data: { name: 'main', commit: { sha: 'abc', url: 'x' }, protected: false } });

            const branch = await github.getBranch(repository, 'main');

            expect(branch).toBeInstanceOf(GitHubBranchDTO);
            expect(branch.commit.sha).toBe('abc');
            expect(octokit.rest.repos.getBranch).toHaveBeenCalledWith(expect.objectContaining({ owner: 'someone', repo: 'kb', branch: 'main' }));
        });

        it('hands the caller\'s signal to the request, so a stopped run cancels it', async () => {
            expect.assertions(1);

            const { signal } = new AbortController();

            octokit.rest.git.getBlob.mockResolvedValue({ data: { sha: 'b', content: '', encoding: 'base64', size: 0 } });
            await github.getBlob(repository, 'b', signal);

            expect(octokit.rest.git.getBlob).toHaveBeenCalledWith(expect.objectContaining({ file_sha: 'b', request: { signal } }));
        });

        it('asks for one commit per page, since the file list comes whole on page one', async () => {
            expect.assertions(3);

            octokit.rest.repos.compareCommitsWithBasehead.mockResolvedValue({
                data: {
                    status: 'ahead',
                    ahead_by: 2,
                    files: [
                        { filename: 'raw/a.md', status: 'added', sha: 's1', additions: 1 },
                        { filename: 'raw/b.md', status: 'renamed', sha: 's2', previous_filename: 'raw/old.md' },
                        { filename: 'sub', status: 'added', sha: null }
                    ]
                }
            });

            const comparison = await github.compare(repository, 'base', 'head');

            expect(comparison).toBeInstanceOf(GitHubCompareDTO);
            expect(comparison).toMatchObject({
                status: GitHubCompareStatusDTO.Ahead,
                files: [
                    { filename: 'raw/a.md', status: GitHubFileStatusDTO.Added, sha: 's1' },
                    { filename: 'raw/b.md', status: GitHubFileStatusDTO.Renamed, sha: 's2', previousFilename: 'raw/old.md' },
                    { filename: 'sub', status: GitHubFileStatusDTO.Added, sha: null }
                ]
            });
            expect(octokit.rest.repos.compareCommitsWithBasehead).toHaveBeenCalledWith(
                expect.objectContaining({ basehead: 'base...head', per_page: 1 })
            );
        });

        it('lists a tree recursively', async () => {
            expect.assertions(3);

            octokit.rest.git.getTree.mockResolvedValue({
                data: { sha: 'head', truncated: false, tree: [{ path: 'raw/a.md', type: 'blob', sha: 'b', mode: '100644' }] }
            });

            const tree = await github.getTree(repository, 'head');

            expect(tree).toBeInstanceOf(GitHubTreeDTO);
            expect(tree.tree).toEqual([expect.objectContaining({ path: 'raw/a.md', type: GitHubTreeEntryTypeDTO.Blob, sha: 'b' })]);
            expect(octokit.rest.git.getTree).toHaveBeenCalledWith(expect.objectContaining({ tree_sha: 'head', recursive: 'true' }));
        });

        it('reads a blob', async () => {
            expect.assertions(2);

            octokit.rest.git.getBlob.mockResolvedValue({ data: { sha: 'b', content: 'IyBUaXRsZQ==', encoding: 'base64', size: 7 } });

            const blob = await github.getBlob(repository, 'b');

            expect(blob).toBeInstanceOf(GitHubBlobDTO);
            expect(blob).toMatchObject({ sha: 'b', content: 'IyBUaXRsZQ==', encoding: 'base64' });
        });

        it('reads a file at a branch, with its blob SHA', async () => {
            expect.assertions(3);

            octokit.rest.repos.getContent.mockResolvedValue({
                data: { type: 'file', path: 'raw/a.md', sha: 'blob', size: 7, content: 'IyBUaXRsZQ==\n', encoding: 'base64', html_url: 'x' }
            });

            const file = await github.getContent(repository, 'raw/a.md', 'main');

            expect(file).toBeInstanceOf(GitHubContentDTO);
            expect(file).toEqual(expect.objectContaining({ type: GitHubContentTypeDTO.File, path: 'raw/a.md', sha: 'blob', encoding: 'base64' }));
            expect(octokit.rest.repos.getContent).toHaveBeenCalledWith({ owner: 'someone', repo: 'kb', path: 'raw/a.md', ref: 'main' });
        });

        it('writes a file with the serialized request, sha only when replacing', async () => {
            expect.assertions(4);

            octokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
                data: { content: { path: 'raw/a.md', sha: 'new-blob', size: 3 }, commit: { sha: 'commit', message: 'm' } }
            });

            const create = CommonUtils.buildModelPartial(GitHubContentPutRequestDTO, { message: 'm', content: 'YQ==', branch: 'main' });
            const result = await github.putContent(repository, 'raw/a.md', create);

            await github.putContent(repository, 'raw/a.md', CommonUtils.buildModelStrict(GitHubContentPutRequestDTO, { message: 'm', content: 'YQ==', branch: 'main', sha: 'old-blob' }));

            expect(result).toBeInstanceOf(GitHubContentCommitDTO);
            expect(result).toMatchObject({ content: { path: 'raw/a.md', sha: 'new-blob' }, commit: { sha: 'commit' } });
            expect(octokit.rest.repos.createOrUpdateFileContents).toHaveBeenNthCalledWith(1, { owner: 'someone', repo: 'kb', path: 'raw/a.md', message: 'm', content: 'YQ==', branch: 'main' });
            expect(octokit.rest.repos.createOrUpdateFileContents).toHaveBeenNthCalledWith(2, expect.objectContaining({ sha: 'old-blob' }));
        });

        it('deletes a file at its blob SHA, and reads a null content back', async () => {
            expect.assertions(2);

            octokit.rest.repos.deleteFile.mockResolvedValue({ data: { content: null, commit: { sha: 'commit', message: 'm' } } });

            const result = await github.deleteContent(
                repository,
                'raw/a.md',
                CommonUtils.buildModelStrict(GitHubContentDeleteRequestDTO, { message: 'm', sha: 'blob', branch: 'main' })
            );

            expect(result).toMatchObject({ content: null, commit: { sha: 'commit' } });
            expect(octokit.rest.repos.deleteFile).toHaveBeenCalledWith({ owner: 'someone', repo: 'kb', path: 'raw/a.md', message: 'm', sha: 'blob', branch: 'main' });
        });
    });
});
