import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceNotification } from '../models/notifications/DeviceNotification.js';
import { NotificationLocalStorageDTO } from '../storage/notification-local-storage/dto/NotificationLocalStorageDTO.js';
import { NotificationLocalStorageRepository } from '../storage/notification-local-storage/NotificationLocalStorageRepository.js';
import { NotificationLocalStorageService } from './NotificationLocalStorageService.js';

const DEVICE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const stored = (id: string, property: string): NotificationLocalStorageDTO => CommonUtils.buildModelStrict(NotificationLocalStorageDTO, {
    id,
    deviceId: DEVICE,
    property,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z')
});

const STATUS = stored('0e9c8a6d-3f1b-4c2a-9d7e-5b4a3c2d1e0f', 'vacuum:status');
const BATTERY = stored('1fad9b7e-4a2c-4d3b-8e8f-6c5b4d3e2f10', 'battery:level');

describe('NotificationLocalStorageService', () => {
    let service: NotificationLocalStorageService;
    let repository: NotificationLocalStorageRepository;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<NotificationLocalStorageService>(NotificationLocalStorageService);
        repository = PlatformTest.get<NotificationLocalStorageRepository>(NotificationLocalStorageRepository);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('getAll', () => {
        it('maps every stored subscription', async () => {
            expect.assertions(2);
            vi.spyOn(repository, 'getAll').mockResolvedValue([STATUS, BATTERY]);

            const notifications = await service.getAll();

            expect(notifications.every(notification => notification instanceof DeviceNotification)).toBe(true);
            expect(notifications.map(notification => notification.id)).toEqual([STATUS.id, BATTERY.id]);
        });
    });

    describe('getById', () => {
        it('maps the stored subscription', async () => {
            expect.assertions(2);
            const getById = vi.spyOn(repository, 'getById').mockResolvedValue(STATUS);

            const notification = await service.getById(STATUS.id);

            expect(getById).toHaveBeenCalledWith(STATUS.id);
            expect(notification).toMatchObject({ id: STATUS.id, deviceId: DEVICE, property: 'vacuum:status' });
        });

        it('returns undefined when nothing is stored under the id', async () => {
            expect.assertions(1);
            vi.spyOn(repository, 'getById').mockResolvedValue(undefined);

            await expect(service.getById(STATUS.id)).resolves.toBeUndefined();
        });
    });

    describe('getAllByDeviceId', () => {
        it('maps the subscriptions of that device', async () => {
            expect.assertions(2);
            const getAllByDeviceId = vi.spyOn(repository, 'getAllByDeviceId').mockResolvedValue([STATUS, BATTERY]);

            const notifications = await service.getAllByDeviceId(DEVICE);

            expect(getAllByDeviceId).toHaveBeenCalledWith(DEVICE);
            expect(notifications.map(notification => notification.id)).toEqual([STATUS.id, BATTERY.id]);
        });
    });

    describe('create', () => {
        it('stores only the subscription, even when handed a whole notification, and returns what was stored', async () => {
            expect.assertions(2);
            const create = vi.spyOn(repository, 'create').mockResolvedValue(STATUS);
            const subscription = CommonUtils.buildModelStrict(DeviceNotification, {
                id: '2abe0c8f-5b3d-4e4c-9f90-7d6c5e4f3a21',
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z'),
                deviceId: DEVICE,
                property: 'vacuum:status'
            });

            const created = await service.create(subscription);

            expect({ ...create.mock.calls[0][0] }).toEqual({ deviceId: DEVICE, property: 'vacuum:status' });
            expect(created).toMatchObject({ id: STATUS.id });
        });
    });

    describe('deleteById / deleteAllByDeviceId', () => {
        it('deletes one subscription by id, or all of a device', async () => {
            expect.assertions(2);
            const deleteById = vi.spyOn(repository, 'deleteById').mockResolvedValue(undefined);
            const deleteAllByDeviceId = vi.spyOn(repository, 'deleteAllByDeviceId').mockResolvedValue(undefined);

            await service.deleteById(STATUS.id);
            await service.deleteAllByDeviceId(DEVICE);

            expect(deleteById).toHaveBeenCalledWith(STATUS.id);
            expect(deleteAllByDeviceId).toHaveBeenCalledWith(DEVICE);
        });
    });
});
