import { Serializer } from '@radoslavirha/tsed-common';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import { GitHubEndpoint } from '../../endpoints/github/GitHubEndpoint.js';
import { GitHubRepositoryService } from './GitHubRepositoryService.js';

const repo = (name: string): GitHubRepositoryDTO => Serializer.deserialize({
    name,
    owner: { login: 'someone' },
    default_branch: 'main',
    html_url: `https://github.test/someone/${name}`
}, GitHubRepositoryDTO);

describe('GitHubRepositoryService', () => {
    let repositories: GitHubRepositoryService;
    let github: GitHubEndpoint;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        repositories = PlatformTest.get<GitHubRepositoryService>(GitHubRepositoryService);
        github = PlatformTest.get<GitHubEndpoint>(GitHubEndpoint);
        repositories.forget();
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('finds the one repository the App can read and remembers it', async () => {
        expect.assertions(2);

        const listing = vi.spyOn(github, 'listRepositories').mockResolvedValue([repo('kb')]);

        expect(await repositories.repository()).toEqual(repo('kb'));
        await repositories.repository();
        expect(listing).toHaveBeenCalledTimes(1);
    });

    it('looks again after forget', async () => {
        expect.assertions(1);

        const listing = vi.spyOn(github, 'listRepositories').mockResolvedValue([repo('kb')]);

        await repositories.repository();
        repositories.forget();
        await repositories.repository();

        expect(listing).toHaveBeenCalledTimes(2);
    });

    it.each([[[]], [[repo('kb'), repo('other')]]])('refuses to guess when the App can read %j', async (listed) => {
        expect.assertions(1);

        vi.spyOn(github, 'listRepositories').mockResolvedValue(listed);

        await expect(repositories.repository()).rejects.toThrow(/needs exactly one/);
    });

    it('does not remember a failure', async () => {
        expect.assertions(2);

        vi.spyOn(github, 'listRepositories').mockRejectedValueOnce(new Error('GitHub down')).mockResolvedValue([repo('kb')]);

        await expect(repositories.repository()).rejects.toThrow('GitHub down');
        expect(await repositories.repository()).toEqual(repo('kb'));
    });
});
