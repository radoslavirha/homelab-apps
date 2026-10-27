import { Serializer } from '@radoslavirha/tsed-common';
import { PlatformTest } from '@tsed/platform-http/testing';
import { RequestError } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubContentCommitDTO } from '../../endpoints/github/dto/GitHubContentCommitDTO.js';
import { GitHubContentDTO } from '../../endpoints/github/dto/GitHubContentDTO.js';
import { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import { GitHubEndpoint } from '../../endpoints/github/GitHubEndpoint.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import { ConfigService } from '../../services/ConfigService.js';
import { SourceWriteRefusedError } from '../SourceWriteRefusedError.js';
import { GitHubRepositoryService } from './GitHubRepositoryService.js';
import { GitSourceWriter } from './GitSourceWriter.js';

const REPOSITORY = Serializer.deserialize({
    name: 'kb',
    owner: { login: 'someone' },
    default_branch: 'main',
    html_url: 'https://github.test/someone/kb'
}, GitHubRepositoryDTO);

const requestError = (status: number): RequestError => new RequestError('x', status, { request: { method: 'PUT', url: 'x', headers: {} } });

const content = (body: object): GitHubContentDTO => Serializer.deserialize({
    type: 'file',
    path: 'work/2026-01-01-x/spec.md',
    sha: 'blob',
    content: Buffer.from('# Spec\n').toString('base64'),
    encoding: 'base64',
    ...body
}, GitHubContentDTO);

const committed = (blob: string | null): GitHubContentCommitDTO => Serializer.deserialize({
    content: blob === null ? null : { path: 'work/2026-01-01-x/spec.md', sha: blob },
    commit: { sha: 'commit' }
}, GitHubContentCommitDTO);

describe('GitSourceWriter', () => {
    const ID = 'work/2026-01-01-x/spec.md';

    let github: GitHubEndpoint;
    let repositories: GitHubRepositoryService;
    let kb: GitKnowledgeBaseConfig;

    const writer = (config: GitKnowledgeBaseConfig = kb): GitSourceWriter => new GitSourceWriter(config, repositories, github);

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        github = PlatformTest.get<GitHubEndpoint>(GitHubEndpoint);
        repositories = PlatformTest.get<GitHubRepositoryService>(GitHubRepositoryService);
        [kb] = PlatformTest.get<ConfigService>(ConfigService).config.knowledgeBases;

        vi.spyOn(repositories, 'repository').mockResolvedValue(REPOSITORY);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('read', () => {
        it('decodes the file on the default branch, its blob SHA as version', async () => {
            expect.assertions(2);

            const get = vi.spyOn(github, 'getContent').mockResolvedValue(content({}));

            expect(await writer().read(ID)).toEqual({ content: '# Spec\n', version: 'blob' });
            expect(get).toHaveBeenCalledWith(REPOSITORY, ID, 'main');
        });

        it('reads the configured branch when there is one', async () => {
            expect.assertions(1);

            const get = vi.spyOn(github, 'getContent').mockResolvedValue(content({}));

            await writer({ ...kb, git: { ...kb.git, branch: 'kb' } }).read(ID);

            expect(get).toHaveBeenCalledWith(REPOSITORY, ID, 'kb');
        });

        it('is null when there is no file', async () => {
            expect.assertions(1);

            vi.spyOn(github, 'getContent').mockRejectedValue(requestError(404));

            expect(await writer().read(ID)).toBeNull();
        });

        it('passes any other failure on', async () => {
            expect.assertions(1);

            vi.spyOn(github, 'getContent').mockRejectedValue(requestError(502));

            await expect(writer().read(ID)).rejects.toBeInstanceOf(RequestError);
        });

        it('refuses a path that is not a file it can read whole', async () => {
            expect.assertions(2);

            vi.spyOn(github, 'getContent').mockResolvedValueOnce(content({ type: 'dir' })).mockResolvedValueOnce(content({ encoding: 'none', content: '' }));

            await expect(writer().read(ID)).rejects.toThrow(/not a file/);
            await expect(writer().read(ID)).rejects.toThrow(/not a file/);
        });
    });

    describe('write', () => {
        it('creates without a sha, the content base64-encoded, and answers the new blob and the commit', async () => {
            expect.assertions(2);

            const put = vi.spyOn(github, 'putContent').mockResolvedValue(committed('new-blob'));

            expect(await writer().write(ID, '# Spec\n', null, 'kb: Spec')).toEqual({ version: 'new-blob', commit: 'commit' });
            expect(put.mock.calls[0][2]).toEqual({ message: 'kb: Spec', content: Buffer.from('# Spec\n').toString('base64'), branch: 'main' });
        });

        it('replaces with the version as sha', async () => {
            expect.assertions(1);

            const put = vi.spyOn(github, 'putContent').mockResolvedValue(committed('new-blob'));

            await writer().write(ID, '# Spec\n', 'old-blob', 'kb: Spec');

            expect(put.mock.calls[0][2]).toMatchObject({ sha: 'old-blob' });
        });

        it.each([404, 409, 422])('turns GitHub\'s %i into a refusal', async (status) => {
            expect.assertions(2);

            vi.spyOn(github, 'putContent').mockRejectedValue(requestError(status));

            const failure = writer().write(ID, '# Spec\n', 'old-blob', 'kb: Spec');

            await expect(failure).rejects.toBeInstanceOf(SourceWriteRefusedError);
            await expect(failure).rejects.toMatchObject({ cause: expect.objectContaining({ status }) });
        });

        it('passes any other failure on', async () => {
            expect.assertions(1);

            vi.spyOn(github, 'putContent').mockRejectedValue(requestError(500));

            await expect(writer().write(ID, '# Spec\n', null, 'kb: Spec')).rejects.toBeInstanceOf(RequestError);
        });
    });

    describe('delete', () => {
        it('deletes at the version, and answers the commit', async () => {
            expect.assertions(2);

            const remove = vi.spyOn(github, 'deleteContent').mockResolvedValue(committed(null));

            expect(await writer().delete(ID, 'blob', 'kb: delete')).toEqual({ commit: 'commit' });
            expect(remove).toHaveBeenCalledWith(REPOSITORY, ID, expect.objectContaining({ message: 'kb: delete', sha: 'blob', branch: 'main' }));
        });

        it('turns a refusal into a refusal', async () => {
            expect.assertions(1);

            vi.spyOn(github, 'deleteContent').mockRejectedValue(requestError(409));

            await expect(writer().delete(ID, 'blob', 'kb: delete')).rejects.toBeInstanceOf(SourceWriteRefusedError);
        });
    });
});
