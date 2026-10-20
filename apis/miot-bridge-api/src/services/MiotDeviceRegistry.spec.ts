import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeviceCache } from '../models/DeviceCache.js';
import { MiotSpecV2 } from '../models/miot-spec-v2/index.js';
import { MiotDeviceRegistry } from './MiotDeviceRegistry.js';

const record = (overrides: Partial<DeviceCache> = {}): DeviceCache => CommonUtils.buildModelStrict(DeviceCache, {
    id: '671b00000000000000000001',
    deviceId: 123456789,
    address: '192.168.1.50',
    token: 'ffffffffffffffffffffffffffffffff',
    model: 'xiaomi.vacuum.c102gl',
    specURL: 'https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1',
    rawSpec: CommonUtils.buildModelCore(MiotSpecV2, { type: 't', description: 'd', services: [] }),
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z'),
    ...overrides
});

describe('MiotDeviceRegistry', () => {
    let registry: MiotDeviceRegistry;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        registry = PlatformTest.get<MiotDeviceRegistry>(MiotDeviceRegistry);
    });
    afterEach(PlatformTest.reset);

    describe('getOrCreate', () => {
        // The stamp is the device's clock. Seeding a new instance from a stored copy cost the first
        // command after every pod restart a 10 s timeout; without one, that command handshakes.
        it('creates the device for the record\'s hardware id with no stamp, so its first command handshakes', () => {
            const device = registry.getOrCreate(record());

            expect(device.deviceId).toBe(123456789);
            expect(device.getStampState()).toBeUndefined();
        });

        it('keeps one instance per hardware id, so the device clock it tracks is kept', () => {
            const first = registry.getOrCreate(record());
            first.setStampState({ stamp: 57, updatedAt: 1760000060000 });

            const again = registry.getOrCreate(record());

            expect(again).toBe(first);
            expect(again.getStampState()).toEqual({ stamp: 57, updatedAt: 1760000060000 });
        });

        it('creates a separate instance for another hardware id', () => {
            const vacuum = registry.getOrCreate(record());

            const sensor = registry.getOrCreate(record({ id: '671b00000000000000000002', deviceId: 987654321 }));

            expect(sensor).not.toBe(vacuum);
            expect(sensor.deviceId).toBe(987654321);
        });
    });

    describe('remove', () => {
        it('drops the instance, so the next lookup starts again with a handshake', () => {
            const first = registry.getOrCreate(record());
            first.setStampState({ stamp: 57, updatedAt: 1760000060000 });

            registry.remove(123456789);
            const next = registry.getOrCreate(record({ address: '192.168.1.51' }));

            expect(next).not.toBe(first);
            expect(next.getStampState()).toBeUndefined();
        });
    });
});
