import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeviceNotification } from '../models/notifications/DeviceNotification.js';
import { NotificationLocalStorageDTO } from '../storage/notification-local-storage/dto/NotificationLocalStorageDTO.js';
import { FileNotificationMapper } from './FileNotificationMapper.js';

const dto = (): NotificationLocalStorageDTO => CommonUtils.buildModelStrict(NotificationLocalStorageDTO, {
    id: '0e9c8a6d-3f1b-4c2a-9d7e-5b4a3c2d1e0f',
    deviceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    property: 'vacuum:status',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z')
});

describe('FileNotificationMapper', () => {
    let mapper: FileNotificationMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<FileNotificationMapper>(FileNotificationMapper);
    });
    afterEach(PlatformTest.reset);

    describe('mapDTOToModel', () => {
        it('copies every stored field into the domain model', () => {
            const stored = dto();

            const notification = mapper.mapDTOToModel(stored);

            expect(notification).toBeInstanceOf(DeviceNotification);
            expect({ ...notification }).toEqual({ ...stored });
        });
    });

    describe('mapModelToDTO', () => {
        it('writes only the subscription, leaving id and timestamps to the repository', () => {
            const created = mapper.mapModelToDTO(mapper.mapDTOToModel(dto()));

            expect({ ...created }).toEqual({ deviceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', property: 'vacuum:status' });
        });
    });
});
