import { PlatformTest } from '@tsed/platform-http/testing';
import type SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../services/ConfigService.js';
import { bootstrapWritable, type WritableServer } from '../test/bootstrapWritable.js';
import { FakeGitHubEndpoint } from '../test/FakeGitHubEndpoint.js';
import { noRoleToken, readerToken } from '../test/tokens.js';

describe('ConventionsController (integration)', () => {
    const README = '# Development KB\n\n## Notes\n\nOne decision per file.\n';

    let server: WritableServer;

    const get = async (query: Record<string, string>, token?: string): Promise<SuperTest.Response> =>
        server.request.get('/conventions').query(query).set('Authorization', `Bearer ${token ?? await readerToken()}`);

    beforeEach(async () => {
        server = await bootstrapWritable();
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('returns the configured file as the source holds it now, though it is not indexed', async () => {
        expect.assertions(2);

        server.github.seed('README.md', README);

        const response = await get({ kb: 'development' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ kb: 'development', path: 'README.md', markdown: README, version: FakeGitHubEndpoint.blobSha(README) });
    });

    it('answers 200 with nulls when the knowledge base names no conventions file', async () => {
        expect.assertions(2);

        const configService = PlatformTest.get<ConfigService>(ConfigService);
        const config = configService.config;

        vi.spyOn(configService, 'config', 'get').mockReturnValue({
            ...config,
            knowledgeBases: config.knowledgeBases.map((kb) => ({ ...kb, conventionsPath: undefined }))
        });

        const response = await get({ kb: 'development' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ kb: 'development', path: null, markdown: null, version: null });
    });

    it('answers 500 when the named file is missing from the source', async () => {
        expect.assertions(2);

        const response = await get({ kb: 'development' });

        expect(response.status).toBe(500);
        expect(response.body.message).toContain('README.md');
    });

    it('answers 404 for a knowledge base the caller cannot read, and 400 without one', async () => {
        expect.assertions(2);

        expect((await get({ kb: 'home' })).status).toBe(404);
        expect((await get({})).status).toBe(400);
    });

    it('refuses without a credential and without the reader role', async () => {
        expect.assertions(2);

        expect((await server.request.get('/conventions').query({ kb: 'development' })).status).toBe(401);
        expect((await get({ kb: 'development' }, await noRoleToken())).status).toBe(403);
    });
});
