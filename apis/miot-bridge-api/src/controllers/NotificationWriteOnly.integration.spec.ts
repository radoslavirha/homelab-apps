import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { authenticateBearerJwt } from '@radoslavirha/tsed-auth';
import { CommonUtils } from '@radoslavirha/utils';
import { Server } from '../Server.js';
import { MqttClientProvider } from '../providers/MqttClientProvider.js';
import type { DeviceCache } from '../models/DeviceCache.js';
import { MiotProperty } from '../models/simplified-miot-spec/MiotProperty.js';
import { PropertyAccess } from '../models/simplified-miot-spec/PropertyAccess.enum.js';
import type { SimplifiedMiotSpec } from '../models/simplified-miot-spec/SimplifiedMiotSpec.js';
import { SimplifiedMiotSpecV2Mapper } from '../mappers/SimplifiedMiotSpecV2Mapper.js';
import { DeviceStorageService } from '../services/DeviceStorageService.js';
import { ModelPropertyOverrideService } from '../services/ModelPropertyOverrideService.js';
import { NotificationStorageService } from '../services/NotificationStorageService.js';
import { DevicePropertyPollerService } from '../services/DevicePropertyPollerService.js';
import { MIOT_PROPERTY_SOURCE_VALUE_SPEC } from '../otel/telemetry.js';

describe('POST /devices/:deviceId/notifications for a write-only property', () => {
    let api: SuperTest.Agent;

    beforeEach(PlatformTest.bootstrap(Server, { imports: [{ token: MqttClientProvider, use: null }] }));
    beforeEach(async () => {
        vi.spyOn(PlatformTest.get<DeviceStorageService>(DeviceStorageService), 'getById').mockResolvedValue({ id: 'd1', model: 'm' } as DeviceCache);
        vi.spyOn(PlatformTest.get<ModelPropertyOverrideService>(ModelPropertyOverrideService), 'getByModel').mockResolvedValue([]);
        vi.spyOn(PlatformTest.get<SimplifiedMiotSpecV2Mapper>(SimplifiedMiotSpecV2Mapper), 'map').mockResolvedValue({
            name: 'vacuum',
            type: 't',
            properties: new Map([
                ['vacuum:target-mode', CommonUtils.buildModelStrict(MiotProperty, {
                    source: MIOT_PROPERTY_SOURCE_VALUE_SPEC, siid: 2, piid: 9, access: [PropertyAccess.Write], values: []
                })]
            ]),
            actions: new Map()
        } as SimplifiedMiotSpec);
        const storage = PlatformTest.get<NotificationStorageService>(NotificationStorageService);
        vi.spyOn(storage, 'getAllByDeviceId').mockResolvedValue([]);
        vi.spyOn(storage, 'create').mockImplementation(async (n) => ({ ...n, id: 'n1' }) as never);
        api = await authenticateBearerJwt(SuperTest.agent(PlatformTest.callback()));
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('refuses a property the poller can never read', async () => {
        const poller = PlatformTest.get<DevicePropertyPollerService>(DevicePropertyPollerService);
        const add = vi.spyOn(poller, 'addSubscriptions');

        const res = await api.post('/devices/d1/notifications').send({ properties: ['vacuum:target-mode'] });

        expect(res.status).toBe(400);
        expect(add).not.toHaveBeenCalled();
    });
});
