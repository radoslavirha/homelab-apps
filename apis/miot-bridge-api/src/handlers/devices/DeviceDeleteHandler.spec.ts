import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiotDeviceRegistry } from '../../services/MiotDeviceRegistry.js';
import { DeviceStorageService } from '../../services/DeviceStorageService.js';
import { NotificationStorageService } from '../../services/NotificationStorageService.js';
import { DeviceDeleteHandler } from './DeviceDeleteHandler.js';
import type { DeviceCache } from '../../models/DeviceCache.js';

const device = { id: 'storage-1', deviceId: 442, address: '192.168.1.10', token: 'a'.repeat(32), stamp: 1, stampUpdatedAt: 0 } as DeviceCache;

describe('DeviceDeleteHandler', () => {
    beforeEach(PlatformTest.create);
    afterEach(() => {
        vi.restoreAllMocks();
        return PlatformTest.reset();
    });

    it('drops the pooled MiotDevice so a re-registered device does not reuse the old address/token', async () => {
        const registry = PlatformTest.get<MiotDeviceRegistry>(MiotDeviceRegistry);
        const storage = PlatformTest.get<DeviceStorageService>(DeviceStorageService);
        vi.spyOn(storage, 'getById').mockResolvedValue(device);
        vi.spyOn(storage, 'delete').mockResolvedValue(undefined);
        vi.spyOn(PlatformTest.get<NotificationStorageService>(NotificationStorageService), 'deleteAllByDeviceId').mockResolvedValue(undefined);

        const stale = registry.getOrCreate(device);
        await PlatformTest.get<DeviceDeleteHandler>(DeviceDeleteHandler).execute('storage-1');

        const reregistered = registry.getOrCreate({ ...device, address: '192.168.1.99' });
        expect(reregistered).not.toBe(stale);
    });
});
