import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestServer } from './test/TestServer.js';

describe('AuthGuard — a route guarded by an unauthenticated method', () => {
    let request: SuperTest.Agent;

    beforeEach(PlatformTest.bootstrap(TestServer));
    beforeEach(() => {
        request = SuperTest.agent(PlatformTest.callback());
    });
    afterEach(PlatformTest.reset);

    it('answers 200 with no credential, as the configured default subject', async () => {
        expect.assertions(2);

        const response = await request.get('/open');

        expect(response.status).toBe(200);
        expect(response.text).toBe('developer');
    });

    it('ignores an Authorization header rather than refusing it', async () => {
        expect.assertions(2);

        const response = await request.get('/open').set('Authorization', 'Bearer not-a-jwt');

        expect(response.status).toBe(200);
        expect(response.text).toBe('developer');
    });

    it('takes the subject label from the configured header', async () => {
        expect.assertions(1);

        const response = await request.get('/open').set('X-User', 'jane.doe');

        expect(response.text).toBe('jane.doe');
    });

    it('answers 403 when the route needs a role the entry does not grant', async () => {
        expect.assertions(1);

        expect((await request.get('/open/admin')).status).toBe(403);
    });
});
