import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { authenticateBearerJwt, mintTestToken } from '@radoslavirha/tsed-auth';
import { CommonUtils } from '@radoslavirha/utils';
import { Server } from '../Server.js';
import { MqttClientProvider } from '../providers/MqttClientProvider.js';
import type { DeviceCache } from '../models/DeviceCache.js';
import { DeviceNotification } from '../models/notifications/DeviceNotification.js';
import { MiotProperty } from '../models/simplified-miot-spec/MiotProperty.js';
import { PropertyAccess } from '../models/simplified-miot-spec/PropertyAccess.enum.js';
import type { SimplifiedMiotSpec } from '../models/simplified-miot-spec/SimplifiedMiotSpec.js';
import { SimplifiedMiotSpecV2Mapper } from '../mappers/SimplifiedMiotSpecV2Mapper.js';
import { DeviceStorageService } from '../services/DeviceStorageService.js';
import { ModelPropertyOverrideService } from '../services/ModelPropertyOverrideService.js';
import { NotificationStorageService } from '../services/NotificationStorageService.js';
import { DevicePropertyPollerService } from '../services/DevicePropertyPollerService.js';
import { MIOT_PROPERTY_SOURCE_VALUE_SPEC } from '../otel/telemetry.js';

/**
 * A **child** controller of `DevicesController`, and the reason this file exists
 * separately rather than being folded into the parent's.
 *
 * Ts.ED's `UseAuth` decorates the methods of the class it sits on, and a child
 * controller is a separate class — it inherits the parent's path prefix and
 * nothing else. Without its own `@Authenticate` these four routes would have
 * shipped open beside every closed route around them, which is precisely the
 * failure a per-controller test catches and a per-service one does not.
 */
describe('DeviceNotificationsController (integration)', () => {
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
            ['post', '/devices/671b00000000000000000001/notifications'],
            ['get', '/devices/671b00000000000000000001/notifications'],
            ['delete', '/devices/671b00000000000000000001/notifications'],
            ['delete', '/devices/671b00000000000000000001/notifications/n1']
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
            const probe = () => request.get('/devices/671b00000000000000000001/notifications');

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

    describe('Subscriptions', () => {
        let rows: DeviceNotification[];
        let poller: DevicePropertyPollerService;

        const row = (id: string, property: string): DeviceNotification => CommonUtils.buildModelStrict(DeviceNotification, {
            id,
            deviceId: 'd1',
            property,
            createdAt: new Date('2026-04-01T00:00:00Z'),
            updatedAt: new Date('2026-04-01T00:00:00Z')
        });

        const property = (piid: number, access: PropertyAccess): MiotProperty => CommonUtils.buildModelStrict(MiotProperty, {
            source: MIOT_PROPERTY_SOURCE_VALUE_SPEC, siid: 2, piid, access: [access], values: []
        });

        beforeEach(() => {
            rows = [];
            poller = PlatformTest.get<DevicePropertyPollerService>(DevicePropertyPollerService);
            vi.spyOn(poller, 'addSubscriptions').mockImplementation(() => undefined);
            vi.spyOn(poller, 'removeSubscription').mockImplementation(() => undefined);
            vi.spyOn(PlatformTest.get<DeviceStorageService>(DeviceStorageService), 'getById').mockResolvedValue({ id: 'd1', model: 'm' } as DeviceCache);
            vi.spyOn(PlatformTest.get<ModelPropertyOverrideService>(ModelPropertyOverrideService), 'getByModel').mockResolvedValue([]);
            vi.spyOn(PlatformTest.get<SimplifiedMiotSpecV2Mapper>(SimplifiedMiotSpecV2Mapper), 'map').mockResolvedValue({
                name: 'vacuum',
                type: 't',
                properties: new Map([
                    ['vacuum:mode', property(4, PropertyAccess.Read)],
                    ['vacuum:target-mode', property(9, PropertyAccess.Write)]
                ]),
                actions: new Map()
            } as SimplifiedMiotSpec);
            const storage = PlatformTest.get<NotificationStorageService>(NotificationStorageService);
            vi.spyOn(storage, 'create').mockImplementation(async (n) => {
                const created = row(`n${rows.length}`, n.property);
                rows.push(created);
                return created;
            });
            vi.spyOn(storage, 'getById').mockImplementation(async (id) => rows.find((r) => r.id === id));
            vi.spyOn(storage, 'getAllByDeviceId').mockImplementation(async (deviceId) => rows.filter((r) => r.deviceId === deviceId));
            vi.spyOn(storage, 'deleteById').mockImplementation(async (id) => {
                rows = rows.filter((r) => r.id !== id);
            });
        });
        afterEach(() => vi.restoreAllMocks());

        it('refuses a property the poller can never read', async () => {
            const res = await api.post('/devices/d1/notifications').send({ properties: ['vacuum:target-mode'] });

            expect(res.status).toBe(400);
            expect(poller.addSubscriptions).not.toHaveBeenCalled();
        });

        it('does not store the same device+property subscription twice', async () => {
            const first = await api.post('/devices/d1/notifications').send({ properties: ['vacuum:mode'] }).expect(201);
            const second = await api.post('/devices/d1/notifications').send({ properties: ['vacuum:mode'] }).expect(201);

            expect(rows).toHaveLength(1);
            expect(second.body.notifications).toHaveLength(1);
            expect(second.body.notifications[0].id).toBe(first.body.notifications[0].id);
        });

        it('keeps the poller subscribed while another row for the property remains', async () => {
            // Duplicate rows persisted before the POST handler deduplicated.
            rows.push(row('a', 'vacuum:mode'), row('b', 'vacuum:mode'));

            await api.delete('/devices/d1/notifications/a').expect(204);

            expect(poller.removeSubscription).not.toHaveBeenCalled();
        });

        it('unsubscribes the poller once the last row for the property is gone', async () => {
            rows.push(row('a', 'vacuum:mode'));

            await api.delete('/devices/d1/notifications/a').expect(204);

            expect(poller.removeSubscription).toHaveBeenCalledWith('d1', 'vacuum:mode');
        });
    });
});
