import { runInContext } from '@tsed/di';
import { Forbidden, InternalServerError } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { TEST_ROLES } from '../test/fixtures.js';
import { McpEndpointService } from './McpEndpointService.js';

/**
 * A request to `url` being handled, as platform-mcp's dispatch runs the tool inside it: the
 * verified caller, if any, on `req.auth` as platform-mcp parks it.
 */
const onRequestTo = <T>(url: string, fn: () => T, roles?: string[]): Promise<T> => {
    const auth = roles === undefined ? undefined : { extra: { principal: { subject: 's', kind: 'human', roles, issuer: 'https://issuer.test/' } } };
    const ctx = PlatformTest.createRequestContext({ event: { request: PlatformTest.createRequest({ url, originalUrl: url, auth }), response: PlatformTest.createResponse() } });

    return runInContext(ctx, fn);
};

describe('McpEndpointService', () => {
    let endpoint: McpEndpointService;

    // config/test.json: DEVELOPMENT_KB at /development serves `dev`.
    beforeEach(PlatformTest.create);
    beforeEach(() => {
        endpoint = PlatformTest.get<McpEndpointService>(McpEndpointService);
    });
    afterEach(PlatformTest.reset);

    it('gives the knowledge base of the endpoint the request came in on', async () => {
        expect.assertions(1);

        await expect(onRequestTo('/development', () => endpoint.knowledgeBase())).resolves.toBe('dev');
    });

    it('matches the path whatever the query string or a trailing slash Express also routes', async () => {
        expect.assertions(2);

        await expect(onRequestTo('/development?x=1', () => endpoint.knowledgeBase())).resolves.toBe('dev');
        await expect(onRequestTo('/development/', () => endpoint.knowledgeBase())).resolves.toBe('dev');
    });

    it('refuses a path no endpoint is mounted at, rather than guessing a knowledge base', async () => {
        expect.assertions(2);

        await expect(onRequestTo('/home', () => endpoint.knowledgeBase())).rejects.toThrow(new InternalServerError('No MCP endpoint is mounted at /home.'));
        await expect(onRequestTo('/', () => endpoint.knowledgeBase())).rejects.toThrow(new InternalServerError('No MCP endpoint is mounted at /.'));
    });

    describe('requireRole', () => {
        it('lets through a caller holding the endpoint\'s role for the level', async () => {
            expect.assertions(2);

            await expect(onRequestTo('/development', () => endpoint.requireRole(KnowledgeBaseRole.Reader), [TEST_ROLES.READER])).resolves.toBeUndefined();
            await expect(onRequestTo('/development', () => endpoint.requireRole(KnowledgeBaseRole.Editor), [TEST_ROLES.READER, TEST_ROLES.EDITOR])).resolves.toBeUndefined();
        });

        it('refuses a caller below the level, naming no role: exact strings, no hierarchy', async () => {
            expect.assertions(2);

            await expect(onRequestTo('/development', () => endpoint.requireRole(KnowledgeBaseRole.Editor), [TEST_ROLES.READER])).rejects.toThrow(new Forbidden('Insufficient permissions.'));
            await expect(onRequestTo('/development', () => endpoint.requireRole(KnowledgeBaseRole.Reader), ['kb-home.reader'])).rejects.toThrow(new Forbidden('Insufficient permissions.'));
        });

        it('refuses a request nobody was verified on', async () => {
            expect.assertions(1);

            await expect(onRequestTo('/development', () => endpoint.requireRole(KnowledgeBaseRole.Reader))).rejects.toThrow(new Forbidden('Insufficient permissions.'));
        });
    });

    it('refuses outside a request: there is no endpoint to take the knowledge base from', () => {
        expect(() => endpoint.knowledgeBase()).toThrow(new InternalServerError('No MCP request is being handled.'));
    });
});
