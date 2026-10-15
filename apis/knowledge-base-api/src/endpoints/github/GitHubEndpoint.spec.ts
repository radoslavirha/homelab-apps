import { Serializer } from '@radoslavirha/tsed-common';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubBlobDTO } from './dto/GitHubBlobDTO.js';
import { GitHubBranchDTO } from './dto/GitHubBranchDTO.js';
import { GitHubCompareDTO } from './dto/GitHubCompareDTO.js';
import { GitHubCompareStatusDTO } from './dto/GitHubCompareStatusDTO.enum.js';
import { GitHubFileStatusDTO } from './dto/GitHubFileStatusDTO.enum.js';
import { GitHubRepositoryDTO } from './dto/GitHubRepositoryDTO.js';
import { GitHubTreeDTO } from './dto/GitHubTreeDTO.js';
import { GitHubTreeEntryTypeDTO } from './dto/GitHubTreeEntryTypeDTO.enum.js';
import { GitHubEndpoint } from './GitHubEndpoint.js';

const octokit = {
    rest: {
        repos: { getBranch: vi.fn(), compareCommitsWithBasehead: vi.fn() },
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
    });
});
