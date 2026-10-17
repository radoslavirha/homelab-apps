import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceNotification } from '../models/notifications/DeviceNotification.js';
import { DeviceNotificationMongoRepository } from '../storage/notification-mongo/DeviceNotificationMongoRepository.js';
import { DeviceNotificationMongoDTO } from '../storage/notification-mongo/dto/DeviceNotificationMongoDTO.js';
import { NotificationStorageService } from './NotificationStorageService.js';

const DEVICE = '671b00000000000000000001';

const stored = (_id: string, property: string): DeviceNotificationMongoDTO => {
    const mongo = new DeviceNotificationMongoDTO();
    mongo._id = _id;
    mongo.createdAt = new Date('2026-04-01T00:00:00Z');
    mongo.updatedAt = new Date('2026-04-02T00:00:00Z');
    mongo.deviceId = DEVICE;
    mongo.property = property;
    return mongo;
};

const STATUS = stored('671b00000000000000000002', 'vacuum:status');
const BATTERY = stored('671b00000000000000000003', 'battery:level');

describe('NotificationStorageService', () => {
    let service: NotificationStorageService;
    let repository: DeviceNotificationMongoRepository;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<NotificationStorageService>(NotificationStorageService);
        repository = PlatformTest.get<DeviceNotificationMongoRepository>(DeviceNotificationMongoRepository);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('getAll', () => {
        it('maps every stored document', async () => {
            expect.assertions(2);
            vi.spyOn(repository, 'findAll').mockResolvedValue([STATUS, BATTERY]);

            const notifications = await service.getAll();

            expect(notifications.every(notification => notification instanceof DeviceNotification)).toBe(true);
            expect(notifications.map(({ id, property }) => ({ id, property }))).toEqual([
                { id: STATUS._id, property: 'vacuum:status' },
                { id: BATTERY._id, property: 'battery:level' }
            ]);
        });
    });

    describe('getById', () => {
        it('maps the stored document', async () => {
            expect.assertions(2);
            const findById = vi.spyOn(repository, 'findById').mockResolvedValue(STATUS);

            const notification = await service.getById(STATUS._id);

            expect(findById).toHaveBeenCalledWith(STATUS._id);
            expect(notification).toMatchObject({ id: STATUS._id, deviceId: DEVICE, property: 'vacuum:status' });
        });

        it('turns the repository\'s null into undefined', async () => {
            expect.assertions(1);
            vi.spyOn(repository, 'findById').mockResolvedValue(null);

            await expect(service.getById(STATUS._id)).resolves.toBeUndefined();
        });
    });

    describe('getAllByDeviceId', () => {
        it('maps the documents of that device', async () => {
            expect.assertions(2);
            const findAllByDeviceId = vi.spyOn(repository, 'findAllByDeviceId').mockResolvedValue([STATUS, BATTERY]);

            const notifications = await service.getAllByDeviceId(DEVICE);

            expect(findAllByDeviceId).toHaveBeenCalledWith(DEVICE);
            expect(notifications.map(notification => notification.id)).toEqual([STATUS._id, BATTERY._id]);
        });
    });

    describe('create', () => {
        it('stores only the subscription, even when handed a whole notification, and returns the stored document', async () => {
            expect.assertions(2);
            const create = vi.spyOn(repository, 'create').mockResolvedValue(STATUS);
            const subscription = CommonUtils.buildModelStrict(DeviceNotification, {
                id: '671b0000000000000000ffff',
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z'),
                deviceId: DEVICE,
                property: 'vacuum:status'
            });

            const created = await service.create(subscription);

            expect({ ...create.mock.calls[0][0] }).toEqual({ deviceId: DEVICE, property: 'vacuum:status' });
            expect(created).toMatchObject({ id: STATUS._id });
        });
    });

    describe('deleteById / deleteAllByDeviceId', () => {
        it('deletes one subscription by id, or all of a device', async () => {
            expect.assertions(2);
            const deleteById = vi.spyOn(repository, 'deleteById').mockResolvedValue(undefined);
            const deleteAllByDeviceId = vi.spyOn(repository, 'deleteAllByDeviceId').mockResolvedValue(undefined);

            await service.deleteById(STATUS._id);
            await service.deleteAllByDeviceId(DEVICE);

            expect(deleteById).toHaveBeenCalledWith(STATUS._id);
            expect(deleteAllByDeviceId).toHaveBeenCalledWith(DEVICE);
        });
    });
});
