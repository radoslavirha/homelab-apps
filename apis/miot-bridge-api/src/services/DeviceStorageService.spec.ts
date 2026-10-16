import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceCache } from '../models/DeviceCache.js';
import { MiotSpecV2 } from '../models/miot-spec-v2/index.js';
import { ConfigService } from './ConfigService.js';
import { DeviceLocalStorageService } from './DeviceLocalStorageService.js';
import { DeviceMongoService } from './DeviceMongoService.js';
import { DeviceStorageService } from './DeviceStorageService.js';

type Method = 'getAll' | 'getById' | 'getByDeviceId' | 'create' | 'update' | 'delete';
type Backend = Record<Method, (...args: unknown[]) => Promise<unknown>>;

/** Lets one table drive every method; the object is the same, so `this` is kept. */
const asBackend = (service: object): Backend => service as unknown as Backend;

const device = CommonUtils.buildModelStrict(DeviceCache, {
    id: '671b00000000000000000001',
    deviceId: 123456789,
    address: '192.168.1.50',
    token: 'ffffffffffffffffffffffffffffffff',
    stamp: 42,
    stampUpdatedAt: 0,
    model: 'xiaomi.vacuum.c102gl',
    specURL: 'https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1',
    rawSpec: CommonUtils.buildModelCore(MiotSpecV2, { type: 't', description: 'd', services: [] }),
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z')
});

const CALLS: [Method, unknown[]][] = [
    ['getAll', []],
    ['getById', [device.id]],
    ['getByDeviceId', [device.deviceId]],
    ['create', [device]],
    ['update', [device]],
    ['delete', [device.id]]
];

describe('DeviceStorageService', () => {
    let local: DeviceLocalStorageService;
    let mongo: DeviceMongoService;

    /** The backend is picked once, when the facade is built — so set the config first, then build it. */
    const facadeWith = (mongodb: ConfigService['config']['mongodb']): Promise<DeviceStorageService> => {
        const configService = PlatformTest.get<ConfigService>(ConfigService);
        vi.spyOn(configService, 'config', 'get').mockReturnValue({ ...configService.config, mongodb });
        return PlatformTest.invoke<DeviceStorageService>(DeviceStorageService, [
            { token: ConfigService, use: configService },
            { token: DeviceLocalStorageService, use: local },
            { token: DeviceMongoService, use: mongo }
        ]);
    };

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        local = PlatformTest.get<DeviceLocalStorageService>(DeviceLocalStorageService);
        mongo = PlatformTest.get<DeviceMongoService>(DeviceMongoService);
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
