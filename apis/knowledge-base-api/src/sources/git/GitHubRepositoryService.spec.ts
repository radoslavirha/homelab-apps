import { Serializer } from '@radoslavirha/tsed-common';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import { GitHubEndpoint } from '../../endpoints/github/GitHubEndpoint.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import { ConfigService } from '../../services/ConfigService.js';
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
    let kb: GitKnowledgeBaseConfig;
    /** A knowledge base with a GitHub App of its own. */
    let own: GitKnowledgeBaseConfig;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        repositories = PlatformTest.get<GitHubRepositoryService>(GitHubRepositoryService);
        github = PlatformTest.get<GitHubEndpoint>(GitHubEndpoint);

        const config = PlatformTest.get<ConfigService>(ConfigService).config;

        [kb] = config.knowledgeBases;
        own = { ...kb, id: 'own', git: { ...kb.git, github: { ...config.github!, clientId: 'Iv-own' } } };
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('finds the one repository the App can read and remembers it', async () => {
        expect.assertions(2);

        const listing = vi.spyOn(github, 'listRepositories').mockResolvedValue([repo('kb')]);

        expect(await repositories.repository(kb)).toEqual(repo('kb'));
        await repositories.repository(kb);
        expect(listing).toHaveBeenCalledTimes(1);
    });

    it('looks again after forget', async () => {
        expect.assertions(1);

        const listing = vi.spyOn(github, 'listRepositories').mockResolvedValue([repo('kb')]);

        await repositories.repository(kb);
        repositories.forget(kb);
        await repositories.repository(kb);

        expect(listing).toHaveBeenCalledTimes(2);
    });

    it.each([[[]], [[repo('kb'), repo('other')]]])('refuses to guess when the App can read %j', async (listed) => {
        expect.assertions(1);

        vi.spyOn(github, 'listRepositories').mockResolvedValue(listed);

        await expect(repositories.repository(kb)).rejects.toThrow(/needs exactly one/);
    });

    it('does not remember a failure', async () => {
        expect.assertions(2);

        vi.spyOn(github, 'listRepositories').mockRejectedValueOnce(new Error('GitHub down')).mockResolvedValue([repo('kb')]);

        await expect(repositories.repository(kb)).rejects.toThrow('GitHub down');
        expect(await repositories.repository(kb)).toEqual(repo('kb'));
    });

    it('tells to set git.repository when the App can read several and none is set', async () => {
        expect.assertions(1);

        vi.spyOn(github, 'listRepositories').mockResolvedValue([repo('kb'), repo('other')]);

        await expect(repositories.repository(kb)).rejects.toThrow(/Set git\.repository/);
    });

    it('does not tell to set git.repository when the App can read none', async () => {
        expect.assertions(1);

        vi.spyOn(github, 'listRepositories').mockResolvedValue([]);

        await expect(repositories.repository(kb)).rejects.not.toThrow(/git\.repository/);
    });

    describe('with git.repository', () => {
        /** A knowledge base on the root App, naming its repository. */
        const named = (id: string, repository: string): GitKnowledgeBaseConfig => ({ ...kb, id, git: { ...kb.git, repository } });

        beforeEach(() => {
            vi.spyOn(github, 'listRepositories').mockResolvedValue([repo('kb'), repo('other')]);
        });

        it('gives two knowledge bases on one App each their own repository', async () => {
            expect.assertions(2);

            expect(await repositories.repository(named('a', 'someone/kb'))).toEqual(repo('kb'));
            expect(await repositories.repository(named('b', 'someone/other'))).toEqual(repo('other'));
        });

        it('compares the name case-insensitively, and answers with GitHub\'s spelling', async () => {
            expect.assertions(1);

            expect(await repositories.repository(named('a', 'SOMEONE/Other'))).toEqual(repo('other'));
        });

        it('uses it when the App can read that one alone', async () => {
            expect.assertions(1);

            vi.mocked(github.listRepositories).mockResolvedValue([repo('kb')]);

            expect(await repositories.repository(named('a', 'someone/kb'))).toEqual(repo('kb'));
        });

        it('refuses a repository the App does not cover, without naming it', async () => {
            expect.assertions(2);

            const refusal = repositories.repository(named('a', 'owner/repo'));

            await expect(refusal).rejects.toThrow(/does not cover its git\.repository/);
            await expect(refusal).rejects.not.toThrow(/owner\/repo/);
        });

        it('refuses the same name under another owner', async () => {
            expect.assertions(1);

            await expect(repositories.repository(named('a', 'owner/kb'))).rejects.toThrow(/does not cover/);
        });

        it('refuses even when the App can read exactly one other repository', async () => {
            expect.assertions(1);

            vi.mocked(github.listRepositories).mockResolvedValue([repo('other')]);

            await expect(repositories.repository(named('a', 'someone/kb'))).rejects.toThrow(/does not cover/);
        });

        it('remembers each repository once, forgetting only the one it is told', async () => {
            expect.assertions(3);

            const a = named('a', 'someone/kb');
            const b = named('b', 'someone/other');

            await repositories.repository(a);
            await repositories.repository(b);
            await repositories.repository(a);
            await repositories.repository(b);
            expect(github.listRepositories).toHaveBeenCalledTimes(2);

            repositories.forget(a);
            await repositories.repository(b);
            expect(github.listRepositories).toHaveBeenCalledTimes(2);

            await repositories.repository(a);
            expect(github.listRepositories).toHaveBeenCalledTimes(3);
        });

        it('picks from a knowledge base\'s own App too', async () => {
            expect.assertions(2);

            vi.mocked(github.listRepositories).mockImplementation((app) => Promise.resolve(app.clientId === 'Iv-own' ? [repo('own-a'), repo('own-b')] : []));

            expect(await repositories.repository({ ...own, git: { ...own.git, repository: 'someone/own-b' } })).toEqual(repo('own-b'));
            expect(github.listRepositories).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'Iv-own' }));
        });

        it('keeps one name on two Apps apart', async () => {
            expect.assertions(2);

            await repositories.repository(named('a', 'someone/kb'));
            await repositories.repository({ ...own, git: { ...own.git, repository: 'someone/kb' } });

            expect(github.listRepositories).toHaveBeenCalledTimes(2);
            expect(github.listRepositories).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: 'Iv-own' }));
        });
    });

    describe('with a knowledge base on its own App', () => {
        beforeEach(() => {
            vi.spyOn(github, 'listRepositories').mockImplementation((app) => Promise.resolve([repo(app.clientId === 'Iv-own' ? 'own-kb' : 'kb')]));
        });

        it('finds each knowledge base\'s repository through its own App', async () => {
            expect.assertions(2);

            expect(await repositories.repository(kb)).toEqual(repo('kb'));
            expect(await repositories.repository(own)).toEqual(repo('own-kb'));
        });

        it('forgets only the App of the knowledge base it is told', async () => {
            expect.assertions(1);

            await repositories.repository(kb);
            await repositories.repository(own);
            repositories.forget(own);
            await repositories.repository(kb);
            await repositories.repository(own);

            expect(github.listRepositories).toHaveBeenCalledTimes(3);
        });

        it('does not let one App\'s refusal stop the other', async () => {
            expect.assertions(2);

            vi.mocked(github.listRepositories).mockImplementation((app) => Promise.resolve(app.clientId === 'Iv-own' ? [repo('a'), repo('b')] : [repo('kb')]));

            await expect(repositories.repository(own)).rejects.toThrow(/needs exactly one/);
            expect(await repositories.repository(kb)).toEqual(repo('kb'));
        });

        it('shares one discovery between knowledge bases on one App', async () => {
            expect.assertions(2);

            expect(await repositories.repository(kb)).toEqual(await repositories.repository({ ...kb, id: 'same-app' }));
            expect(github.listRepositories).toHaveBeenCalledTimes(1);
        });
    });
});
