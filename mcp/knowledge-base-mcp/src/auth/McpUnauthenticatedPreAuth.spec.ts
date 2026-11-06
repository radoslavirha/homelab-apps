import { UNAUTHENTICATED_ISSUER } from '@radoslavirha/auth';
import type { PlatformContext } from '@tsed/platform-http';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpServerAuthConfigSchema, type McpServerUnauthenticatedConfig } from '../models/config/McpServerAuthConfig.js';
import { TEST_OPEN_SERVER } from '../test/fixtures.js';
import { McpUnauthenticatedPreAuth } from './McpUnauthenticatedPreAuth.js';

/** A request to the open endpoint carrying `headers`, as platform-mcp hands it to `preAuth`. */
const requestWith = (headers: Record<string, string>): PlatformContext =>
    PlatformTest.createRequestContext({ event: { request: PlatformTest.createRequest({ url: '/open', headers }), response: PlatformTest.createResponse() } });

describe('McpUnauthenticatedPreAuth', () => {
    let check: McpUnauthenticatedPreAuth;

    // For the logger its boot warning goes to.
    beforeEach(PlatformTest.create);
    beforeEach(() => {
        check = new McpUnauthenticatedPreAuth('OPEN_KB', TEST_OPEN_SERVER.auth);
    });
    afterEach(PlatformTest.reset);

    it('admits a request with no credential as the default subject, holding every configured role', async () => {
        expect.assertions(1);

        await expect(check.preAuth(requestWith({}))).resolves.toEqual({
            token: '',
            clientId: '',
            scopes: [],
            extra: {
                principal: {
                    subject: 'developer',
                    kind: 'human',
                    roles: ['knowledge-base-mcp-open.reader', 'knowledge-base-mcp-open.editor'],
                    issuer: UNAUTHENTICATED_ISSUER
                }
            }
        });
    });

    it('names the caller by the subject header when it sends one', async () => {
        expect.assertions(1);

        await expect(check.preAuth(requestWith({ 'x-user': 'alice' }))).resolves.toMatchObject({ extra: { principal: { subject: 'alice' } } });
    });

    it('falls back to the default subject for a header On-Behalf-Of would refuse, rather than refusing', async () => {
        expect.assertions(1);

        await expect(check.preAuth(requestWith({ 'x-user': 'alice smith' }))).resolves.toMatchObject({ extra: { principal: { subject: 'developer' } } });
    });

    it('ignores a bearer token: nobody verifies one here', async () => {
        expect.assertions(1);

        await expect(check.preAuth(requestWith({ authorization: 'Bearer not-a-jwt' }))).resolves.toMatchObject({ extra: { principal: { subject: 'developer' } } });
    });

    it('grants every level when the entry names no roles', async () => {
        expect.assertions(1);

        const config = McpServerAuthConfigSchema.parse({ type: 'unauthenticated', defaultSubject: 'developer' }) as McpServerUnauthenticatedConfig;
        const defaults = new McpUnauthenticatedPreAuth('OPEN_KB', config);

        await expect(defaults.preAuth(requestWith({}))).resolves.toMatchObject({ extra: { principal: { roles: ['knowledge-base-mcp.reader', 'knowledge-base-mcp.editor'] } } });
    });

    it('grants only the levels the entry maps', async () => {
        expect.assertions(1);

        const readOnly = new McpUnauthenticatedPreAuth('OPEN_KB', { ...TEST_OPEN_SERVER.auth, roles: { READER: 'kb.reader' } });

        await expect(readOnly.preAuth(requestWith({}))).resolves.toMatchObject({ extra: { principal: { roles: ['kb.reader'] } } });
    });
});
