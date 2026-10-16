import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeviceNotification } from '../models/notifications/DeviceNotification.js';
import { NotificationMapper } from './NotificationMapper.js';

describe('NotificationMapper', () => {
    let mapper: NotificationMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<NotificationMapper>(NotificationMapper);
    });
    afterEach(PlatformTest.reset);

    describe('mapCacheToNotification', () => {
        it('returns a copy carrying every field of the stored notification', () => {
            const stored = CommonUtils.buildModelStrict(DeviceNotification, {
                id: '671b00000000000000000002',
                createdAt: new Date('2026-04-01T00:00:00Z'),
                updatedAt: new Date('2026-04-02T00:00:00Z'),
                deviceId: '671b00000000000000000001',
                property: 'vacuum:status'
            });

            const response = mapper.mapCacheToNotification(stored);

            expect(response).toBeInstanceOf(DeviceNotification);
            expect(response).not.toBe(stored);
            expect(response).toEqual(stored);
        });
    });
});
