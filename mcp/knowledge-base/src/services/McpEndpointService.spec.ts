import { runInContext } from '@tsed/di';
import { InternalServerError } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpEndpointService } from './McpEndpointService.js';

/** A request to `url` being handled, as platform-mcp's dispatch runs the tool inside it. */
const onRequestTo = <T>(url: string, fn: () => T): Promise<T> => {
    const ctx = PlatformTest.createRequestContext({ event: { request: PlatformTest.createRequest({ url, originalUrl: url }), response: PlatformTest.createResponse() } });

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

    it('refuses outside a request: there is no endpoint to take the knowledge base from', () => {
        expect(() => endpoint.knowledgeBase()).toThrow(new InternalServerError('No MCP request is being handled.'));
    });
});
