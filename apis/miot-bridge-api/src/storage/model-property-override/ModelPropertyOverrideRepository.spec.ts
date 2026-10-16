import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../../services/ConfigService.js';
import { ModelPropertyOverrideAccessDTO } from './dto/ModelPropertyOverrideAccessDTO.enum.js';
import { ModelPropertyOverrideLocalStorageDTO } from './dto/ModelPropertyOverrideLocalStorageDTO.js';
import { ModelPropertyValueDTO } from './dto/ModelPropertyValueDTO.js';
import { ModelPropertyOverrideRepository } from './ModelPropertyOverrideRepository.js';

const VACUUM = 'xiaomi.vacuum.c102gl';
const SENSOR = 'miaomiaoce.sensor_ht.t2';

const override = (model: string, key: string): Omit<ModelPropertyOverrideLocalStorageDTO, 'id' | 'createdAt' | 'updatedAt'> =>
    CommonUtils.buildModelCore(ModelPropertyOverrideLocalStorageDTO, {
        model,
        key,
        siid: 2,
        piid: 6,
        access: [ModelPropertyOverrideAccessDTO.Read, ModelPropertyOverrideAccessDTO.Write],
        values: [CommonUtils.buildModelStrict(ModelPropertyValueDTO, { value: 2, description: 'Vacuuming' })]
    });

/** The repository reads `cachePath` once, when it is built — so point the config first, then build it. */
const repositoryIn = (cachePath: string): Promise<ModelPropertyOverrideRepository> => {
    const configService = PlatformTest.get<ConfigService>(ConfigService);
    vi.spyOn(configService, 'config', 'get').mockReturnValue({ ...configService.config, cachePath });
    return PlatformTest.invoke<ModelPropertyOverrideRepository>(ModelPropertyOverrideRepository, [{ token: ConfigService, use: configService }]);
};

describe('ModelPropertyOverrideRepository', () => {
    let cacheDir: string;
    let repository: ModelPropertyOverrideRepository;

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        cacheDir = await mkdtemp(join(tmpdir(), 'miot-overrides-'));
        repository = await repositoryIn(cacheDir);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());
    afterEach(() => vi.useRealTimers());
    afterEach(() => rm(cacheDir, { recursive: true, force: true }));

    describe('getAll', () => {
        it('returns no overrides before anything was stored, without creating the file', async () => {
            expect.assertions(2);

            await expect(repository.getAll()).resolves.toEqual([]);
            expect(existsSync(join(cacheDir, 'model-property-overrides.json'))).toBe(false);
        });
    });

    describe('create', () => {
        it('assigns an id and timestamps', async () => {
            expect.assertions(3);
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));

            const created = await repository.create(override(VACUUM, 'sweep-mode'));

            expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
            expect(created.createdAt).toEqual(new Date('2026-04-01T00:00:00Z'));
            expect(created.updatedAt).toEqual(created.createdAt);
        });

        it('persists to model-property-overrides.json under cachePath and reads it back as DTOs with dates', async () => {
            expect.assertions(4);
            const created = await repository.create(override(VACUUM, 'sweep-mode'));

            const written = JSON.parse(await readFile(join(cacheDir, 'model-property-overrides.json'), 'utf-8'));
            const [stored] = await (await repositoryIn(cacheDir)).getAll();

            expect(written).toHaveLength(1);
            expect(stored).toBeInstanceOf(ModelPropertyOverrideLocalStorageDTO);
            expect(stored.values[0]).toBeInstanceOf(ModelPropertyValueDTO);
            expect(stored).toEqual(created);
        });
    });

    describe('getById', () => {
        it('finds a stored override, or returns undefined', async () => {
            expect.assertions(2);
            const created = await repository.create(override(VACUUM, 'sweep-mode'));

            await expect(repository.getById(created.id)).resolves.toEqual(created);
            await expect(repository.getById('00000000-0000-4000-8000-000000000000')).resolves.toBeUndefined();
        });
    });

    describe('getByModel', () => {
        it('returns only the overrides of that model', async () => {
            expect.assertions(1);
            const sweep = await repository.create(override(VACUUM, 'sweep-mode'));
            await repository.create(override(SENSOR, 'comfort-level'));
            const fan = await repository.create(override(VACUUM, 'turbo-fan'));

            await expect(repository.getByModel(VACUUM)).resolves.toEqual([sweep, fan]);
        });
    });

    describe('delete', () => {
        it('removes only that override', async () => {
            expect.assertions(1);
            const sweep = await repository.create(override(VACUUM, 'sweep-mode'));
            const fan = await repository.create(override(VACUUM, 'turbo-fan'));

            await repository.delete(sweep.id);

            await expect(repository.getAll()).resolves.toEqual([fan]);
        });
    });
});
