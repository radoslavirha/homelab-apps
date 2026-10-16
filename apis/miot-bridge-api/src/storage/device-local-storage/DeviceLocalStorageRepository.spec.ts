import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlatformTest } from '@tsed/platform-http/testing';
import { Serializer } from '@radoslavirha/tsed-common';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiotSpecV2DTO } from '../../endpoints/miot-spec-v2/dto/index.js';
import { ConfigService } from '../../services/ConfigService.js';
import { VACUUM_SPEC } from '../../test/vacuumSpec.js';
import { DeviceLocalStorageDTO } from './dto/DeviceLocalStorageDTO.js';
import { DeviceLocalStorageRepository } from './DeviceLocalStorageRepository.js';

const device = (deviceId: number): Omit<DeviceLocalStorageDTO, 'id' | 'createdAt' | 'updatedAt'> =>
    CommonUtils.buildModelCore(DeviceLocalStorageDTO, {
        deviceId,
        address: '192.168.1.50',
        token: 'ffffffffffffffffffffffffffffffff',
        stamp: 42,
        model: 'xiaomi.vacuum.c102gl',
        specURL: 'https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1',
        rawSpec: Serializer.deserialize<MiotSpecV2DTO>(VACUUM_SPEC, MiotSpecV2DTO),
        stampUpdatedAt: 1760000000000
    });

/** The repository reads `cachePath` once, when it is built — so point the config first, then build it. */
const repositoryIn = (cachePath: string): Promise<DeviceLocalStorageRepository> => {
    const configService = PlatformTest.get<ConfigService>(ConfigService);
    vi.spyOn(configService, 'config', 'get').mockReturnValue({ ...configService.config, cachePath });
    return PlatformTest.invoke<DeviceLocalStorageRepository>(DeviceLocalStorageRepository, [{ token: ConfigService, use: configService }]);
};

describe('DeviceLocalStorageRepository', () => {
    let cacheDir: string;
    let repository: DeviceLocalStorageRepository;

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        cacheDir = await mkdtemp(join(tmpdir(), 'miot-devices-'));
        repository = await repositoryIn(cacheDir);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());
    afterEach(() => vi.useRealTimers());
    afterEach(() => rm(cacheDir, { recursive: true, force: true }));

    describe('getAll', () => {
        it('returns no devices before anything was stored, without creating the file', async () => {
            expect.assertions(2);

            await expect(repository.getAll()).resolves.toEqual([]);
            expect(existsSync(join(cacheDir, 'devices.json'))).toBe(false);
        });
    });

    describe('create', () => {
        it('assigns an id and timestamps', async () => {
            expect.assertions(3);
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));

            const created = await repository.create(device(1));

            expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
            expect(created.createdAt).toEqual(new Date('2026-04-01T00:00:00Z'));
            expect(created.updatedAt).toEqual(created.createdAt);
        });

        it('persists to devices.json under cachePath, creating the directory and keeping the spec wire format', async () => {
            expect.assertions(2);
            const nested = await repositoryIn(join(cacheDir, 'not', 'yet'));

            await nested.create(device(1));

            const written = JSON.parse(await readFile(join(cacheDir, 'not', 'yet', 'devices.json'), 'utf-8'));
            expect(written).toHaveLength(1);
            expect(written[0].rawSpec).toEqual(VACUUM_SPEC);
        });

        it('reads back what it wrote as DTOs with dates', async () => {
            expect.assertions(4);
            const created = await repository.create(device(1));

            const [stored] = await (await repositoryIn(cacheDir)).getAll();

            expect(stored).toBeInstanceOf(DeviceLocalStorageDTO);
            expect(stored.rawSpec).toBeInstanceOf(MiotSpecV2DTO);
            expect(stored.createdAt).toBeInstanceOf(Date);
            expect(stored).toEqual(created);
        });
    });

    describe('getById / getByDeviceId', () => {
        it('finds a stored device by its id or its hardware id', async () => {
            expect.assertions(2);
            await repository.create(device(1));
            const second = await repository.create(device(2));

            await expect(repository.getById(second.id)).resolves.toEqual(second);
            await expect(repository.getByDeviceId(2)).resolves.toEqual(second);
        });

        it('returns undefined for an unknown device', async () => {
            expect.assertions(2);
            await repository.create(device(1));

            await expect(repository.getById('00000000-0000-4000-8000-000000000000')).resolves.toBeUndefined();
            await expect(repository.getByDeviceId(999)).resolves.toBeUndefined();
        });
    });

    describe('update', () => {
        it('replaces the stored device and bumps updatedAt', async () => {
            expect.assertions(3);
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));
            const created = await repository.create(device(1));
            const other = await repository.create(device(2));
            vi.setSystemTime(new Date('2026-04-02T00:00:00Z'));

            const updated = await repository.update({ ...created, address: '192.168.1.51', stamp: 43 });

            expect(updated).toMatchObject({ address: '192.168.1.51', stamp: 43, createdAt: created.createdAt, updatedAt: new Date('2026-04-02T00:00:00Z') });
            await expect(repository.getById(created.id)).resolves.toEqual(updated);
            await expect(repository.getById(other.id)).resolves.toEqual(other);
        });
    });

    describe('delete', () => {
        it('removes only that device', async () => {
            expect.assertions(1);
            const first = await repository.create(device(1));
            const second = await repository.create(device(2));

            await repository.delete(first.id);

            await expect(repository.getAll()).resolves.toEqual([second]);
        });
    });

    describe('writeAll', () => {
        it('replaces every stored device', async () => {
            expect.assertions(1);
            await repository.create(device(1));
            const replacement = await (await repositoryIn(join(cacheDir, 'other'))).create(device(2));

            await repository.writeAll([replacement]);

            await expect(repository.getAll()).resolves.toEqual([replacement]);
        });
    });
});
