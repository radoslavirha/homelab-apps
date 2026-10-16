import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceNotification } from '../models/notifications/DeviceNotification.js';
import { ConfigService } from './ConfigService.js';
import { DeviceNotificationMongoService } from './DeviceNotificationMongoService.js';
import { NotificationLocalStorageService } from './NotificationLocalStorageService.js';
import { NotificationStorageService } from './NotificationStorageService.js';

type Method = 'getAll' | 'getById' | 'getAllByDeviceId' | 'create' | 'deleteById' | 'deleteAllByDeviceId';
type Backend = Record<Method, (...args: unknown[]) => Promise<unknown>>;

/** Lets one table drive every method; the object is the same, so `this` is kept. */
const asBackend = (service: object): Backend => service as unknown as Backend;

const notification = CommonUtils.buildModelStrict(DeviceNotification, {
    id: '671b00000000000000000002',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z'),
    deviceId: '671b00000000000000000001',
    property: 'vacuum:status'
});

const CALLS: [Method, unknown[]][] = [
    ['getAll', []],
    ['getById', [notification.id]],
    ['getAllByDeviceId', [notification.deviceId]],
    ['create', [notification]],
    ['deleteById', [notification.id]],
    ['deleteAllByDeviceId', [notification.deviceId]]
];

describe('NotificationStorageService', () => {
    let local: NotificationLocalStorageService;
    let mongo: DeviceNotificationMongoService;

    /** The backend is picked once, when the facade is built — so set the config first, then build it. */
    const facadeWith = (mongodb: ConfigService['config']['mongodb']): Promise<NotificationStorageService> => {
        const configService = PlatformTest.get<ConfigService>(ConfigService);
        vi.spyOn(configService, 'config', 'get').mockReturnValue({ ...configService.config, mongodb });
        return PlatformTest.invoke<NotificationStorageService>(NotificationStorageService, [
            { token: ConfigService, use: configService },
            { token: NotificationLocalStorageService, use: local },
            { token: DeviceNotificationMongoService, use: mongo }
        ]);
    };

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        local = PlatformTest.get<NotificationLocalStorageService>(NotificationLocalStorageService);
        mongo = PlatformTest.get<DeviceNotificationMongoService>(DeviceNotificationMongoService);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe.each([
        ['absent', undefined],
        ['disabled', { enabled: false as const }]
    ])('with mongodb %s', (_, mongodb) => {
        it.each(CALLS)('%s goes to the local file storage', async (method, args) => {
            expect.assertions(3);
            const result = Symbol(method);
            const toLocal = vi.spyOn(asBackend(local), method).mockResolvedValue(result);
            const toMongo = vi.spyOn(asBackend(mongo), method).mockResolvedValue(undefined);
            const facade = asBackend(await facadeWith(mongodb));

            await expect(facade[method](...args)).resolves.toBe(result);
            expect(toLocal).toHaveBeenCalledWith(...args);
            expect(toMongo).not.toHaveBeenCalled();
        });
    });

    describe('with mongodb enabled', () => {
        it.each(CALLS)('%s goes to MongoDB', async (method, args) => {
            expect.assertions(3);
            const result = Symbol(method);
            const toMongo = vi.spyOn(asBackend(mongo), method).mockResolvedValue(result);
            const toLocal = vi.spyOn(asBackend(local), method).mockResolvedValue(undefined);
            const facade = asBackend(await facadeWith({ enabled: true, url: 'mongodb://mongo.home:27017/miot' }));

            await expect(facade[method](...args)).resolves.toBe(result);
            expect(toMongo).toHaveBeenCalledWith(...args);
            expect(toLocal).not.toHaveBeenCalled();
        });
    });
});
