import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelPropertyOverride } from '../models/model-property-override/ModelPropertyOverride.js';
import { MiotPropertyValue } from '../models/simplified-miot-spec/MiotPropertyValue.js';
import { PropertyAccess } from '../models/simplified-miot-spec/PropertyAccess.enum.js';
import { ModelPropertyOverrideAccessDTO } from '../storage/model-property-override/dto/ModelPropertyOverrideAccessDTO.enum.js';
import { ModelPropertyOverrideLocalStorageDTO } from '../storage/model-property-override/dto/ModelPropertyOverrideLocalStorageDTO.js';
import { ModelPropertyOverrideRepository } from '../storage/model-property-override/ModelPropertyOverrideRepository.js';
import { ModelPropertyOverrideLocalStorageService } from './ModelPropertyOverrideLocalStorageService.js';

const MODEL = 'xiaomi.vacuum.c102gl';

const stored = (id: string, key: string): ModelPropertyOverrideLocalStorageDTO => CommonUtils.buildModelStrict(ModelPropertyOverrideLocalStorageDTO, {
    id,
    model: MODEL,
    key,
    siid: 2,
    piid: 6,
    access: [ModelPropertyOverrideAccessDTO.Read, ModelPropertyOverrideAccessDTO.Write],
    values: [{ value: 2, description: 'Vacuuming' }],
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z')
});

const SWEEP = stored('4b3a2c1d-0e9f-4a8b-8c7d-6e5f4a3b2c1d', 'sweep-mode');
const FAN = stored('5c4b3d2e-1f0a-4b9c-9d8e-7f6a5b4c3d2e', 'turbo-fan');

describe('ModelPropertyOverrideLocalStorageService', () => {
    let service: ModelPropertyOverrideLocalStorageService;
    let repository: ModelPropertyOverrideRepository;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<ModelPropertyOverrideLocalStorageService>(ModelPropertyOverrideLocalStorageService);
        repository = PlatformTest.get<ModelPropertyOverrideRepository>(ModelPropertyOverrideRepository);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('getAll', () => {
        it('maps every stored override', async () => {
            expect.assertions(2);
            vi.spyOn(repository, 'getAll').mockResolvedValue([SWEEP, FAN]);

            const overrides = await service.getAll();

            expect(overrides.every(override => override instanceof ModelPropertyOverride)).toBe(true);
            expect(overrides.map(override => override.key)).toEqual(['sweep-mode', 'turbo-fan']);
        });
    });

    describe('getByModel', () => {
        it('maps the overrides of that model', async () => {
            expect.assertions(2);
            const getByModel = vi.spyOn(repository, 'getByModel').mockResolvedValue([SWEEP]);

            const overrides = await service.getByModel(MODEL);

            expect(getByModel).toHaveBeenCalledWith(MODEL);
            expect(overrides).toMatchObject([{ id: SWEEP.id, model: MODEL, access: [PropertyAccess.Read, PropertyAccess.Write] }]);
        });
    });

    describe('create', () => {
        it('stores the override without id or timestamps, even when handed a whole one, and returns what was stored', async () => {
            expect.assertions(3);
            const create = vi.spyOn(repository, 'create').mockResolvedValue(SWEEP);
            const override = CommonUtils.buildModelStrict(ModelPropertyOverride, {
                id: '6d5c4e3f-2a1b-4c0d-8e9f-8a7b6c5d4e3f',
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z'),
                model: MODEL,
                key: 'sweep-mode',
                siid: 2,
                piid: 6,
                access: [PropertyAccess.Read, PropertyAccess.Write],
                values: [CommonUtils.buildModelStrict(MiotPropertyValue, { value: 2, description: 'Vacuuming' })]
            });

            const created = await service.create(override);

            const [written] = create.mock.calls[0];
            expect(written).not.toHaveProperty('id');
            expect(written.access).toEqual([ModelPropertyOverrideAccessDTO.Read, ModelPropertyOverrideAccessDTO.Write]);
            expect(created).toMatchObject({ id: SWEEP.id, key: 'sweep-mode' });
        });
    });

    describe('delete', () => {
        it('deletes by id', async () => {
            expect.assertions(1);
            const remove = vi.spyOn(repository, 'delete').mockResolvedValue(undefined);

            await service.delete(SWEEP.id);

            expect(remove).toHaveBeenCalledWith(SWEEP.id);
        });
    });
});
