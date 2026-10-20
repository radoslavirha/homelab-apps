import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeviceCache } from '../models/DeviceCache.js';
import { DeviceWithSpec } from '../models/DeviceWithSpec.js';
import { MiotSpecV2 } from '../models/miot-spec-v2/index.js';
import { SimplifiedMiotSpec } from '../models/simplified-miot-spec/SimplifiedMiotSpec.js';
import { DeviceMapper } from './DeviceMapper.js';

const device = (): DeviceCache => CommonUtils.buildModelStrict(DeviceCache, {
    id: '671b00000000000000000001',
    deviceId: 123456789,
    address: '192.168.1.50',
    token: 'ffffffffffffffffffffffffffffffff',
    model: 'xiaomi.vacuum.c102gl',
    specURL: 'https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1',
    rawSpec: CommonUtils.buildModelCore(MiotSpecV2, { type: 't', description: 'd', services: [] }),
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z')
});

const spec = (): SimplifiedMiotSpec => CommonUtils.buildModelStrict(SimplifiedMiotSpec, {
    name: 'Robot Cleaner',
    type: 'urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1',
    properties: new Map(),
    actions: new Map()
});

describe('DeviceMapper', () => {
    let mapper: DeviceMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<DeviceMapper>(DeviceMapper);
    });
    afterEach(PlatformTest.reset);

    describe('mapCacheToDeviceWithSpec', () => {
        it('copies the device fields and attaches the parsed spec', () => {
            const cached = device();
            const parsed = spec();

            const response = mapper.mapCacheToDeviceWithSpec(cached, parsed);

            expect(response).toBeInstanceOf(DeviceWithSpec);
            expect(response).toMatchObject({
                id: cached.id,
                deviceId: cached.deviceId,
                address: cached.address,
                token: cached.token,
                model: cached.model,
                specURL: cached.specURL,
                createdAt: cached.createdAt,
                updatedAt: cached.updatedAt
            });
            expect(response.spec).toBe(parsed);
        });

        it('leaves the raw spec out of the response', () => {
            const response = mapper.mapCacheToDeviceWithSpec(device(), spec());

            expect(response).not.toHaveProperty('rawSpec');
        });
    });
});
