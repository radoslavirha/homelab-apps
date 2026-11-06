import { Serializer } from '@radoslavirha/tsed-common';
import { PlatformTest } from '@tsed/platform-http/testing';
import { RequestError } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubContentDTO } from '../../endpoints/github/dto/GitHubContentDTO.js';
import { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import { GitHubEndpoint } from '../../endpoints/github/GitHubEndpoint.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import { ConfigService } from '../../services/ConfigService.js';
import { GitHubRepositoryService } from './GitHubRepositoryService.js';
import { GitFileReader } from './GitFileReader.js';

const REPOSITORY = Serializer.deserialize({
    name: 'kb',
    owner: { login: 'someone' },
    default_branch: 'main',
    html_url: 'https://github.test/someone/kb'
}, GitHubRepositoryDTO);

const requestError = (status: number): RequestError => new RequestError('x', status, { request: { method: 'GET', url: 'x', headers: {} } });

const content = (body: object): GitHubContentDTO => Serializer.deserialize({
    type: 'file',
    path: 'work/2026-01-01-x/spec.md',
    sha: 'blob',
    content: Buffer.from('# Spec\n').toString('base64'),
    encoding: 'base64',
    ...body
}, GitHubContentDTO);

describe('GitFileReader', () => {
    const ID = 'work/2026-01-01-x/spec.md';

    let github: GitHubEndpoint;
    let repositories: GitHubRepositoryService;
    let kb: GitKnowledgeBaseConfig;

    const reader = (config: GitKnowledgeBaseConfig = kb): GitFileReader => new GitFileReader(config, repositories, github);

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        github = PlatformTest.get<GitHubEndpoint>(GitHubEndpoint);
        repositories = PlatformTest.get<GitHubRepositoryService>(GitHubRepositoryService);
        [kb] = PlatformTest.get<ConfigService>(ConfigService).config.knowledgeBases;

        vi.spyOn(repositories, 'repository').mockResolvedValue(REPOSITORY);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('decodes the file on the default branch, its blob SHA as version', async () => {
        expect.assertions(2);

        const get = vi.spyOn(github, 'getContent').mockResolvedValue(content({}));

        expect(await reader().read(ID)).toEqual({ content: '# Spec\n', version: 'blob' });
        expect(get).toHaveBeenCalledWith(REPOSITORY, ID, 'main');
    });

    it('reads the configured branch when there is one', async () => {
        expect.assertions(1);

        const get = vi.spyOn(github, 'getContent').mockResolvedValue(content({}));

        await reader({ ...kb, git: { ...kb.git, branch: 'kb' } }).read(ID);

        expect(get).toHaveBeenCalledWith(REPOSITORY, ID, 'kb');
    });

    it('is null when there is no file', async () => {
        expect.assertions(1);

        vi.spyOn(github, 'getContent').mockRejectedValue(requestError(404));

        expect(await reader().read(ID)).toBeNull();
    });

    it('passes any other failure on', async () => {
        expect.assertions(1);

        vi.spyOn(github, 'getContent').mockRejectedValue(requestError(502));

        await expect(reader().read(ID)).rejects.toBeInstanceOf(RequestError);
    });

    it('refuses a path that is not a file it can read whole', async () => {
        expect.assertions(2);

        vi.spyOn(github, 'getContent').mockResolvedValueOnce(content({ type: 'dir' })).mockResolvedValueOnce(content({ encoding: 'none', content: '' }));

        await expect(reader().read(ID)).rejects.toThrow(/not a file/);
        await expect(reader().read(ID)).rejects.toThrow(/not a file/);
    });
});
