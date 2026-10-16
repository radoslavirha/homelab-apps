import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../../services/ConfigService.js';
import { NotificationLocalStorageDTO } from './dto/NotificationLocalStorageDTO.js';
import { NotificationLocalStorageRepository } from './NotificationLocalStorageRepository.js';

const VACUUM = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SENSOR = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

const subscription = (deviceId: string, property: string): Omit<NotificationLocalStorageDTO, 'id' | 'createdAt' | 'updatedAt'> =>
    CommonUtils.buildModelCore(NotificationLocalStorageDTO, { deviceId, property });

/** The repository reads `cachePath` once, when it is built — so point the config first, then build it. */
const repositoryIn = (cachePath: string): Promise<NotificationLocalStorageRepository> => {
    const configService = PlatformTest.get<ConfigService>(ConfigService);
    vi.spyOn(configService, 'config', 'get').mockReturnValue({ ...configService.config, cachePath });
    return PlatformTest.invoke<NotificationLocalStorageRepository>(NotificationLocalStorageRepository, [{ token: ConfigService, use: configService }]);
};

describe('NotificationLocalStorageRepository', () => {
    let cacheDir: string;
    let repository: NotificationLocalStorageRepository;

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        cacheDir = await mkdtemp(join(tmpdir(), 'miot-notifications-'));
        repository = await repositoryIn(cacheDir);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());
    afterEach(() => vi.useRealTimers());
    afterEach(() => rm(cacheDir, { recursive: true, force: true }));

    describe('getAll', () => {
        it('returns no subscriptions before anything was stored, without creating the file', async () => {
            expect.assertions(2);

            await expect(repository.getAll()).resolves.toEqual([]);
            expect(existsSync(join(cacheDir, 'notifications.json'))).toBe(false);
        });
    });

    describe('create', () => {
        it('assigns an id and timestamps', async () => {
            expect.assertions(3);
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));

            const created = await repository.create(subscription(VACUUM, 'vacuum:status'));

            expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
            expect(created.createdAt).toEqual(new Date('2026-04-01T00:00:00Z'));
            expect(created.updatedAt).toEqual(created.createdAt);
        });

        it('persists to notifications.json under cachePath and reads it back as DTOs with dates', async () => {
            expect.assertions(3);
            const created = await repository.create(subscription(VACUUM, 'vacuum:status'));

            const written = JSON.parse(await readFile(join(cacheDir, 'notifications.json'), 'utf-8'));
            const [stored] = await (await repositoryIn(cacheDir)).getAll();

            expect(written).toHaveLength(1);
            expect(stored).toBeInstanceOf(NotificationLocalStorageDTO);
            expect(stored).toEqual(created);
        });
    });

    describe('getById', () => {
        it('finds a stored subscription, or returns undefined', async () => {
            expect.assertions(2);
            const created = await repository.create(subscription(VACUUM, 'vacuum:status'));

            await expect(repository.getById(created.id)).resolves.toEqual(created);
            await expect(repository.getById('00000000-0000-4000-8000-000000000000')).resolves.toBeUndefined();
        });
    });

    describe('getAllByDeviceId', () => {
        it('returns only the subscriptions of that device', async () => {
            expect.assertions(1);
            const status = await repository.create(subscription(VACUUM, 'vacuum:status'));
            await repository.create(subscription(SENSOR, 'sensor:temperature'));
            const battery = await repository.create(subscription(VACUUM, 'battery:level'));

            await expect(repository.getAllByDeviceId(VACUUM)).resolves.toEqual([status, battery]);
        });
    });

    describe('deleteById', () => {
        it('removes only that subscription', async () => {
            expect.assertions(1);
            const status = await repository.create(subscription(VACUUM, 'vacuum:status'));
            const battery = await repository.create(subscription(VACUUM, 'battery:level'));

            await repository.deleteById(status.id);

            await expect(repository.getAll()).resolves.toEqual([battery]);
        });
    });

    describe('deleteAllByDeviceId', () => {
        it('removes every subscription of that device and keeps the others', async () => {
            expect.assertions(1);
            await repository.create(subscription(VACUUM, 'vacuum:status'));
            const temperature = await repository.create(subscription(SENSOR, 'sensor:temperature'));
            await repository.create(subscription(VACUUM, 'battery:level'));

            await repository.deleteAllByDeviceId(VACUUM);

            await expect(repository.getAll()).resolves.toEqual([temperature]);
        });
    });
});
