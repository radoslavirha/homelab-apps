// apis/miot-bridge-api/src/controllers/CommandGetValue.integration.spec.ts
import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { authenticateBearerJwt } from '@radoslavirha/tsed-auth';
import { CommonUtils } from '@radoslavirha/utils';
import type { MiotDevice } from '@radoslavirha/miot-device';
import { Server } from '../Server.js';
import { MqttClientProvider } from '../providers/MqttClientProvider.js';
import type { DeviceCache } from '../models/DeviceCache.js';
import { MiotProperty } from '../models/simplified-miot-spec/MiotProperty.js';
import { MiotPropertyValue } from '../models/simplified-miot-spec/MiotPropertyValue.js';
import { PropertyAccess } from '../models/simplified-miot-spec/PropertyAccess.enum.js';
import type { SimplifiedMiotSpec } from '../models/simplified-miot-spec/SimplifiedMiotSpec.js';
import { SimplifiedMiotSpecV2Mapper } from '../mappers/SimplifiedMiotSpecV2Mapper.js';
import { DeviceStorageService } from '../services/DeviceStorageService.js';
import { ModelPropertyOverrideService } from '../services/ModelPropertyOverrideService.js';
import { MiotDeviceRegistry } from '../services/MiotDeviceRegistry.js';
import { MIOT_PROPERTY_SOURCE_VALUE_SPEC } from '../otel/telemetry.js';

const DEVICE_ID = 442;

const prop = (piid: number, extra: Partial<MiotProperty>): MiotProperty =>
    CommonUtils.buildModelStrict(MiotProperty, {
        source: MIOT_PROPERTY_SOURCE_VALUE_SPEC,
        siid: 2,
        piid,
        access: [PropertyAccess.Read, PropertyAccess.Write],
        values: [],
        ...extra
    });

const spec = (): SimplifiedMiotSpec =>
    ({
        name: 'vacuum',
        type: 'urn:miot-spec-v2:device:vacuum',
        properties: new Map<string, MiotProperty>([
            ['vacuum:mode', prop(1, { values: [CommonUtils.buildModelStrict(MiotPropertyValue, { value: 1, description: 'quiet' })] })],
            ['light:brightness', prop(2, { format: 'uint8', valueRange: [1, 100, 1] })],
            ['light:on', prop(3, { format: 'bool' })]
        ]),
        actions: new Map()
    }) as SimplifiedMiotSpec;

describe('GET /command SetProperty value coercion', () => {
    let api: SuperTest.Agent;
    const setProperty = vi.fn(async () => undefined);

    beforeEach(PlatformTest.bootstrap(Server, { imports: [{ token: MqttClientProvider, use: null }] }));
    beforeEach(async () => {
        setProperty.mockClear();
        const device = { id: 'x', deviceId: DEVICE_ID, address: '10.0.0.1', token: 'a'.repeat(32), model: 'm' } as DeviceCache;
        vi.spyOn(PlatformTest.get<DeviceStorageService>(DeviceStorageService), 'getByDeviceId').mockResolvedValue(device);
        vi.spyOn(PlatformTest.get<ModelPropertyOverrideService>(ModelPropertyOverrideService), 'getByModel').mockResolvedValue([]);
        vi.spyOn(PlatformTest.get<SimplifiedMiotSpecV2Mapper>(SimplifiedMiotSpecV2Mapper), 'map').mockResolvedValue(spec());
        vi.spyOn(PlatformTest.get<MiotDeviceRegistry>(MiotDeviceRegistry), 'getOrCreate').mockReturnValue(
            { setProperty } as unknown as MiotDevice
        );
        api = await authenticateBearerJwt(SuperTest.agent(PlatformTest.callback()), { claims: { roles: ['miot-bridge.admin'] } });
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('POST accepts value 1 for an enum property (control)', async () => {
        await api.post('/command').send({ deviceId: DEVICE_ID, command: 'vacuum:mode', operation: 'SET_PROPERTY', value: 1 }).expect(200);
        expect(setProperty).toHaveBeenCalledWith(2, 1, 1);
    });

    it.each([
        ['vacuum:mode', '1', 1],
        ['light:brightness', '50', 50],
        ['light:on', 'true', true]
    ])('GET accepts %s=%s like POST does', async (command, query, expected) => {
        const res = await api.get('/command').query({ deviceId: DEVICE_ID, command, operation: 'SET_PROPERTY', value: query });

        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(setProperty).toHaveBeenCalledWith(2, expect.any(Number), expected);
    });

    it('GET /command/raw sends numbers and booleans with their JSON type', async () => {
        await api.get('/command/raw').query({ deviceId: DEVICE_ID, operation: 'SET_PROPERTY', siid: 2, piid: 1, value: '1' }).expect(200);
        expect(setProperty).toHaveBeenLastCalledWith(2, 1, 1);

        await api.get('/command/raw').query({ deviceId: DEVICE_ID, operation: 'SET_PROPERTY', siid: 2, piid: 3, value: 'true' }).expect(200);
        expect(setProperty).toHaveBeenLastCalledWith(2, 3, true);
    });

    it('GET still rejects a value outside the enum', async () => {
        await api.get('/command').query({ deviceId: DEVICE_ID, command: 'vacuum:mode', operation: 'SET_PROPERTY', value: '2' }).expect(400);
        expect(setProperty).not.toHaveBeenCalled();
    });
});
