import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { authenticateBearerJwt, mintTestToken } from '@radoslavirha/tsed-auth';
import { BaseLogger, type LoggerMetadata } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { DeviceCache } from '../models/DeviceCache.js';
import { MiotSpecV2 } from '../models/miot-spec-v2/index.js';
import { Server } from '../Server.js';
import { MqttClientProvider } from '../providers/MqttClientProvider.js';
import { DeviceStorageService } from '../services/DeviceStorageService.js';
import { MiotDeviceRegistry } from '../services/MiotDeviceRegistry.js';
import { NotificationStorageService } from '../services/NotificationStorageService.js';

/**
 * The device registry. Registration performs a handshake and fetches a spec from
 * `miot-spec.org`, so an open `POST /devices` is an outbound-request amplifier as
 * well as a write.
 */
describe('DevicesController (integration)', () => {
    let request: SuperTest.Agent;
    let api: SuperTest.Agent;

    beforeEach(PlatformTest.bootstrap(Server, {
        imports: [{ token: MqttClientProvider, use: null }]
    }));
    beforeEach(async () => {
        request = SuperTest.agent(PlatformTest.callback());
        // A second agent carrying a valid token as a default header. Two agents
        // rather than one, because `agent.set` is sticky — an authenticated
        // agent cannot also serve the anonymous cases.
        api = await authenticateBearerJwt(SuperTest.agent(PlatformTest.callback()));
    });
    afterEach(PlatformTest.reset);

    describe('Authentication', () => {
        const routes: ReadonlyArray<readonly [string, string]> = [
            ['post', '/devices/discover'],
            ['post', '/devices'],
            ['get', '/devices'],
            ['get', '/devices/671b00000000000000000001'],
            ['delete', '/devices/671b00000000000000000001']
        ];

        describe.each(routes)('%s %s', (method, path) => {
            const call = (agent: SuperTest.Agent) => agent[method as 'get'](path);

            it('refuses a caller with no credential', async () => {
                await call(request).expect(401);
            });

            it('refuses a token signed by somebody else', async () => {
                const forged = await mintTestToken({ secret: 'a-different-secret-0000000000000' });

                await call(request).set('Authorization', `Bearer ${forged}`).expect(401);
            });

            it('does not answer 401 for a valid token', async () => {
                // Deliberately not asserting a success status. Past the guard these
                // routes want a body, a real device, or storage a bare test config
                // does not have — what matters is that authentication stopped being
                // the reason for the refusal.
                const response = await call(api);

                expect(response.status).not.toBe(401);
            });
        });

        describe('the refusals that separate a token from a token for us', () => {
            const probe = () => request.get('/devices');

            it('refuses a valid token minted for another audience', async () => {
                const elsewhere = await mintTestToken({ audience: 'some-other-api' });

                await probe().set('Authorization', `Bearer ${elsewhere}`).expect(401);
            });

            it('refuses a valid token from another issuer', async () => {
                const elsewhere = await mintTestToken({ issuer: 'https://not-our-idp.test/' });

                await probe().set('Authorization', `Bearer ${elsewhere}`).expect(401);
            });

            it('refuses an expired token', async () => {
                const stale = await mintTestToken({ expiresIn: '-5m' });

                await probe().set('Authorization', `Bearer ${stale}`).expect(401);
            });

            it('ignores a non-bearer scheme rather than treating it as a bad token', async () => {
                await probe().set('Authorization', 'Basic dXNlcjpwYXNz').expect(401);
            });

            it('leaks nothing about why the credential was refused', async () => {
                // The operator-facing detail names the audience that did not match.
                // Handing it back tells an attacker which part to fix next.
                const elsewhere = await mintTestToken({ audience: 'some-other-api' });
                const response = await probe().set('Authorization', `Bearer ${elsewhere}`);

                expect(JSON.stringify(response.body)).not.toContain('some-other-api');
            });
        });
    });

    describe('DELETE /devices/:id', () => {
        const device = { id: 'storage-1', deviceId: 442, address: '192.168.1.10', token: 'a'.repeat(32), stamp: 1, stampUpdatedAt: 0 } as DeviceCache;
        let storage: DeviceStorageService;

        beforeEach(() => {
            storage = PlatformTest.get<DeviceStorageService>(DeviceStorageService);
            vi.spyOn(storage, 'delete').mockResolvedValue(undefined);
            vi.spyOn(PlatformTest.get<NotificationStorageService>(NotificationStorageService), 'deleteAllByDeviceId').mockResolvedValue(undefined);
        });
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('drops the pooled MiotDevice so a re-registered device does not reuse the old address/token', async () => {
            const registry = PlatformTest.get<MiotDeviceRegistry>(MiotDeviceRegistry);
            vi.spyOn(storage, 'getById').mockResolvedValue(device);
            const stale = registry.getOrCreate(device);

            await api.delete('/devices/storage-1').expect(204);

            const reregistered = registry.getOrCreate({ ...device, address: '192.168.1.99' });
            expect(reregistered).not.toBe(stale);
        });

        it('returns 404 when the device does not exist', async () => {
            vi.spyOn(storage, 'getById').mockResolvedValue(undefined);

            await api.delete('/devices/storage-1').expect(404);
            expect(storage.delete).not.toHaveBeenCalled();
        });
    });

    describe('Request logging', () => {
        const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
        let emitted: ReturnType<typeof vi.fn<(message: string, meta?: LoggerMetadata) => void>>;

        beforeEach(() => {
            // The request logger writes through a private child of `Logger`; the public
            // base class it inherits `info`/`error` from is the seam to observe it.
            emitted = vi.fn<(message: string, meta?: LoggerMetadata) => void>();
            vi.spyOn(BaseLogger.prototype, 'info').mockImplementation(emitted);
            vi.spyOn(BaseLogger.prototype, 'error').mockImplementation(emitted);
        });
        afterEach(() => {
            vi.restoreAllMocks();
        });

        const device = (): DeviceCache => CommonUtils.buildModelStrict(DeviceCache, {
            id: 'a',
            deviceId: 1,
            address: '10.0.0.2',
            token: TOKEN,
            stamp: 5,
            stampUpdatedAt: 1,
            model: 'm',
            specURL: 'u',
            createdAt: new Date(),
            updatedAt: new Date(),
            rawSpec: CommonUtils.buildModelCore(MiotSpecV2, { type: 't', description: 'd', services: [] })
        });

        it('does not log the token of a device returned by GET /devices/:id', async () => {
            vi.spyOn(PlatformTest.get<DeviceStorageService>(DeviceStorageService), 'getById').mockResolvedValue(device());

            const response = await api.get('/devices/a').expect(200);

            expect(JSON.stringify(response.body)).not.toContain(TOKEN);
            expect(emitted).toHaveBeenCalled();
            expect(JSON.stringify(emitted.mock.calls)).not.toContain(TOKEN);
        });

        it('does not log the tokens of the devices returned by GET /devices', async () => {
            vi.spyOn(PlatformTest.get<DeviceStorageService>(DeviceStorageService), 'getAll').mockResolvedValue([device()]);

            const response = await api.get('/devices').expect(200);

            expect(JSON.stringify(response.body)).not.toContain(TOKEN);
            expect(emitted).toHaveBeenCalled();
            expect(JSON.stringify(emitted.mock.calls)).not.toContain(TOKEN);
        });
    });
});
