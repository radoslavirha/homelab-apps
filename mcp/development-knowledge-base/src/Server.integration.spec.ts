import { HealthCheckService, ShutdownState } from '@radoslavirha/tsed-health';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from './Server.js';

describe('Server (integration)', () => {
    let request: SuperTest.Agent;

    beforeEach(PlatformTest.bootstrap(Server));
    beforeEach(() => {
        request = SuperTest.agent(PlatformTest.callback());
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('health', () => {
        it('registers no check yet: nothing it depends on exists', () => {
            expect(PlatformTest.get<HealthCheckService>(HealthCheckService).checks()).toEqual([]);
        });

        it('answers liveness', async () => {
            expect.assertions(2);

            const response = await request.get('/health/live');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ status: 'pass' });
        });

        it('answers readiness', async () => {
            expect.assertions(2);

            const response = await request.get('/health/ready');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ status: 'pass' });
        });

        it('answers the full report as application/health+json', async () => {
            expect.assertions(3);

            const response = await request.get('/health');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('application/health+json');
            expect(response.body.status).toBe('pass');
        });

        it('stops being ready while draining, and stays live', async () => {
            expect.assertions(2);

            vi.spyOn(PlatformTest.get<ShutdownState>(ShutdownState), 'draining', 'get').mockReturnValue(true);

            expect((await request.get('/health/ready')).status).toBe(503);
            expect((await request.get('/health/live')).status).toBe(200);
        });
    });

    it('serves nothing else yet', async () => {
        expect.assertions(1);

        expect((await request.get('/')).status).toBe(404);
    });
});
