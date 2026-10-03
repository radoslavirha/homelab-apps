import { describe, beforeEach, afterEach, it, vi } from 'vitest';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { BrokenCircuitError, TaskCancelledError } from '@radoslavirha/resilience';
import { Server } from '../Server.js';
import { QrCodeMongoRepository } from '../storage/qr-mongo/QrCodeMongoRepository.js';

describe('GET /r/:slug when the slug lookup policy rejects', () => {
    let request: SuperTest.Agent;
    let repository: QrCodeMongoRepository;

    beforeEach(PlatformTest.bootstrap(Server));
    beforeEach(() => {
        request = SuperTest(PlatformTest.callback());
        repository = PlatformTest.get<QrCodeMongoRepository>(QrCodeMongoRepository);
    });
    afterEach(PlatformTest.reset);
    afterEach(vi.restoreAllMocks);

    it('answers 503 when the circuit is open', async () => {
        vi.spyOn(repository, 'findBySlug').mockRejectedValue(new BrokenCircuitError());
        await request.get('/r/x7k2').expect(503);
    });

    it('answers 504 when the lookup times out', async () => {
        vi.spyOn(repository, 'findBySlug').mockRejectedValue(new TaskCancelledError('Operation timed out'));
        await request.get('/r/x7k2').expect(504);
    });
});
