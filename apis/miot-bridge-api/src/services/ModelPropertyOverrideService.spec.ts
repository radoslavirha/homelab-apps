import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelPropertyOverride } from '../models/model-property-override/ModelPropertyOverride.js';
import { MiotPropertyValue } from '../models/simplified-miot-spec/MiotPropertyValue.js';
import { PropertyAccess } from '../models/simplified-miot-spec/PropertyAccess.enum.js';
import { ModelPropertyOverrideAccessMongoDTO } from '../storage/model-property-override-mongo/dto/ModelPropertyOverrideAccessMongoDTO.enum.js';
import { ModelPropertyOverrideMongoDTO } from '../storage/model-property-override-mongo/dto/ModelPropertyOverrideMongoDTO.js';
import { ModelPropertyOverrideMongoRepository } from '../storage/model-property-override-mongo/ModelPropertyOverrideMongoRepository.js';
import { ModelPropertyOverrideService } from './ModelPropertyOverrideService.js';

const MODEL = 'xiaomi.vacuum.c102gl';

const stored = (_id: string, key: string): ModelPropertyOverrideMongoDTO => {
    const mongo = new ModelPropertyOverrideMongoDTO();
    mongo._id = _id;
    mongo.createdAt = new Date('2026-04-01T00:00:00Z');
    mongo.updatedAt = new Date('2026-04-02T00:00:00Z');
    mongo.modelName = MODEL;
    mongo.key = key;
    mongo.siid = 2;
    mongo.piid = 6;
    mongo.access = [ModelPropertyOverrideAccessMongoDTO.Read, ModelPropertyOverrideAccessMongoDTO.Write];
    mongo.values = [{ value: 2, description: 'Vacuuming' }];
    return mongo;
};

const SWEEP = stored('671b00000000000000000004', 'sweep-mode');
const FAN = stored('671b00000000000000000005', 'turbo-fan');

describe('ModelPropertyOverrideService', () => {
    let service: ModelPropertyOverrideService;
    let repository: ModelPropertyOverrideMongoRepository;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<ModelPropertyOverrideService>(ModelPropertyOverrideService);
        repository = PlatformTest.get<ModelPropertyOverrideMongoRepository>(ModelPropertyOverrideMongoRepository);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('getAll', () => {
        it('maps every stored document', async () => {
            expect.assertions(2);
            vi.spyOn(repository, 'findAll').mockResolvedValue([SWEEP, FAN]);

            const overrides = await service.getAll();

            expect(overrides.every(override => override instanceof ModelPropertyOverride)).toBe(true);
            expect(overrides.map(override => override.id)).toEqual([SWEEP._id, FAN._id]);
        });
    });

    describe('getByModel', () => {
        it('maps the documents of that model', async () => {
            expect.assertions(2);
            const findByModel = vi.spyOn(repository, 'findByModel').mockResolvedValue([SWEEP]);

            const overrides = await service.getByModel(MODEL);

            expect(findByModel).toHaveBeenCalledWith(MODEL);
            expect(overrides).toMatchObject([{ id: SWEEP._id, model: MODEL, key: 'sweep-mode' }]);
        });
    });

    describe('create', () => {
        it('stores the create payload and returns the stored document', async () => {
            expect.assertions(2);
            const create = vi.spyOn(repository, 'create').mockResolvedValue(SWEEP);
            const override = CommonUtils.buildModelCore(ModelPropertyOverride, {
                model: MODEL,
                key: 'sweep-mode',
                siid: 2,
                piid: 6,
                access: [PropertyAccess.Read, PropertyAccess.Write],
                values: [CommonUtils.buildModelStrict(MiotPropertyValue, { value: 2, description: 'Vacuuming' })]
            });

            const created = await service.create(override);

            expect(create.mock.calls[0][0]).toMatchObject({ modelName: MODEL, key: 'sweep-mode' });
            expect(created).toMatchObject({ id: SWEEP._id, model: MODEL });
        });
    });

    describe('delete', () => {
        it('deletes by id', async () => {
            expect.assertions(1);
            const deleteById = vi.spyOn(repository, 'deleteById').mockResolvedValue(undefined);

            await service.delete(SWEEP._id);

            expect(deleteById).toHaveBeenCalledWith(SWEEP._id);
        });
    });
});
