import { PlatformTest } from '@tsed/platform-http/testing';
import type { MiotDevice } from '@radoslavirha/miot-device';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceCommandOperation } from '../models/DeviceCommandOperation.enum.js';
import type { DeviceCache } from '../models/DeviceCache.js';
import type { DeviceCommandRequest } from '../models/DeviceCommandRequest.js';
import type { MiotSpecV2 } from '../models/miot-spec-v2/MiotSpecV2.js';
import { DeviceCommandService } from './DeviceCommandService.js';
import { DeviceStorageService } from './DeviceStorageService.js';
import { MiotDeviceRegistry } from './MiotDeviceRegistry.js';
import { ModelPropertyOverrideService } from './ModelPropertyOverrideService.js';

// Writable properties published with `format: bool` or a `value-range` carry no `value-list`.
const rawSpec = {
    type: 'urn:miot-spec-v2:device:light',
    description: 'light',
    services: [{
        iid: 2, type: 'urn:miot-spec-v2:service:light:00007802:vendor:1', description: 'light',
        properties: [
            { iid: 1, type: 'urn:miot-spec-v2:property:on:00000006:vendor:1', description: 'Switch', format: 'BOOL', access: ['READ', 'WRITE', 'NOTIFY'] },
            { iid: 2, type: 'urn:miot-spec-v2:property:brightness:0000000D:vendor:1', description: 'Brightness', format: 'UINT8', access: ['READ', 'WRITE', 'NOTIFY'], valueRange: [1, 100, 1] },
            { iid: 3, type: 'urn:miot-spec-v2:property:name:0000000E:vendor:1', description: 'Name', format: 'STRING', access: ['READ', 'WRITE'] }
        ]
    }]
} as unknown as MiotSpecV2;

describe('DeviceCommandService SetProperty on value-less properties', () => {
    const setProperty = vi.fn(async () => undefined);

    const run = (command: string, value: unknown) => PlatformTest.get<DeviceCommandService>(DeviceCommandService)
        .execute({ deviceId: 1, command, operation: DeviceCommandOperation.SetProperty, value } as unknown as DeviceCommandRequest);

    beforeEach(async () => {
        setProperty.mockClear();
        await PlatformTest.create();
        const storage = PlatformTest.get<DeviceStorageService>(DeviceStorageService);
        const dev = { id: 'x', deviceId: 1, address: '1.1.1.1', token: 'a'.repeat(32), model: 'm', rawSpec } as unknown as DeviceCache;
        vi.spyOn(storage, 'getByDeviceId').mockResolvedValue(dev);
        vi.spyOn(PlatformTest.get<ModelPropertyOverrideService>(ModelPropertyOverrideService), 'getByModel').mockResolvedValue([]);
        vi.spyOn(PlatformTest.get<MiotDeviceRegistry>(MiotDeviceRegistry), 'getOrCreate').mockReturnValue({ setProperty } as unknown as MiotDevice);
    });
    afterEach(PlatformTest.reset);

    it('Should allow setting a bool property', async () => {
        await run('light:on', true);
        expect(setProperty).toHaveBeenCalledWith(2, 1, true);
    });

    it('Should reject a non-boolean value for a bool property', async () => {
        await expect(run('light:on', 'yes')).rejects.toThrow(/not allowed/);
        expect(setProperty).not.toHaveBeenCalled();
    });

    it('Should allow setting an in-range value', async () => {
        await run('light:brightness', 50);
        expect(setProperty).toHaveBeenCalledWith(2, 2, 50);
    });

    it.each([0, 101, 50.5, '50'])('Should reject out-of-range or off-step value %j', async (value) => {
        await expect(run('light:brightness', value)).rejects.toThrow(/not allowed/);
        expect(setProperty).not.toHaveBeenCalled();
    });

    it('Should not constrain a property that publishes no value-list or range', async () => {
        await run('light:name', 'lamp');
        expect(setProperty).toHaveBeenCalledWith(2, 3, 'lamp');
    });
});
