import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceStorageService } from '../../services/DeviceStorageService.js';
import { NotificationStorageService } from '../../services/NotificationStorageService.js';
import { ModelPropertyOverrideService } from '../../services/ModelPropertyOverrideService.js';
import { SimplifiedMiotSpecV2Mapper } from '../../mappers/SimplifiedMiotSpecV2Mapper.js';
import { DevicePropertyPollerService } from '../../services/DevicePropertyPollerService.js';
import { NotificationPostHandler } from './NotificationPostHandler.js';
import { NotificationDeleteHandler } from './NotificationDeleteHandler.js';
import { PropertyAccess } from '../../models/simplified-miot-spec/PropertyAccess.enum.js';
import type { DeviceCache } from '../../models/DeviceCache.js';

describe('notification subscriptions', () => {
    let rows: Array<{ id: string; deviceId: string; property: string }>;
    let storage: NotificationStorageService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        rows = [];
        storage = PlatformTest.get<NotificationStorageService>(NotificationStorageService);
        vi.spyOn(PlatformTest.get<DeviceStorageService>(DeviceStorageService), 'getById').mockResolvedValue({ id: 'd1', model: 'm' } as DeviceCache);
        vi.spyOn(PlatformTest.get<ModelPropertyOverrideService>(ModelPropertyOverrideService), 'getByModel').mockResolvedValue([]);
        vi.spyOn(PlatformTest.get<SimplifiedMiotSpecV2Mapper>(SimplifiedMiotSpecV2Mapper), 'map').mockResolvedValue({
            properties: new Map([['s:p', { access: [PropertyAccess.Read] }]])
        } as never);
        vi.spyOn(storage, 'create').mockImplementation(async (n) => {
            const row = { ...n, id: `n${rows.length}` };
            rows.push(row);
            return row as never;
        });
        vi.spyOn(storage, 'getById').mockImplementation(async (id) => rows.find((r) => r.id === id) as never);
        vi.spyOn(storage, 'getAllByDeviceId').mockImplementation(async (deviceId) => rows.filter((r) => r.deviceId === deviceId) as never);
        vi.spyOn(storage, 'deleteById').mockImplementation(async (id) => {
            rows.splice(
                rows.findIndex((r) => r.id === id),
                1
            );
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
        return PlatformTest.reset();
    });

    function subscriptions(): Map<string, Set<string>> {
        return (PlatformTest.get<DevicePropertyPollerService>(DevicePropertyPollerService) as unknown as { _subscriptions: Map<string, Set<string>> })._subscriptions;
    }

    it('does not store the same device+property subscription twice', async () => {
        const post = PlatformTest.get<NotificationPostHandler>(NotificationPostHandler);
        const first = await post.execute('d1', { properties: ['s:p'] } as never);
        const second = await post.execute('d1', { properties: ['s:p'] } as never);

        expect(rows).toHaveLength(1);
        expect(second.notifications).toHaveLength(1);
        expect(second.notifications[0].id).toBe(first.notifications[0].id);
    });

    it('keeps the poller subscribed while another row for the property remains', async () => {
        // Duplicate rows persisted before the POST handler deduplicated.
        rows.push({ id: 'a', deviceId: 'd1', property: 's:p' }, { id: 'b', deviceId: 'd1', property: 's:p' });
        subscriptions().set('d1', new Set(['s:p']));

        await PlatformTest.get<NotificationDeleteHandler>(NotificationDeleteHandler).execute('d1', 'a');

        expect(subscriptions().get('d1')?.has('s:p')).toBe(true);
    });
});
