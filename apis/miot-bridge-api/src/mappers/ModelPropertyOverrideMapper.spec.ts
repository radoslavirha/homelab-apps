import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelPropertyOverride } from '../models/model-property-override/ModelPropertyOverride.js';
import { MiotPropertyValue } from '../models/simplified-miot-spec/MiotPropertyValue.js';
import { PropertyAccess } from '../models/simplified-miot-spec/PropertyAccess.enum.js';
import { ModelPropertyOverrideAccessDTO } from '../storage/model-property-override/dto/ModelPropertyOverrideAccessDTO.enum.js';
import { ModelPropertyOverrideLocalStorageDTO } from '../storage/model-property-override/dto/ModelPropertyOverrideLocalStorageDTO.js';
import { ModelPropertyOverrideMapper } from './ModelPropertyOverrideMapper.js';

const dto = (): ModelPropertyOverrideLocalStorageDTO => CommonUtils.buildModelStrict(ModelPropertyOverrideLocalStorageDTO, {
    id: '4b3a2c1d-0e9f-4a8b-8c7d-6e5f4a3b2c1d',
    model: 'xiaomi.vacuum.c102gl',
    key: 'sweep-mode',
    siid: 2,
    piid: 6,
    access: [ModelPropertyOverrideAccessDTO.Read, ModelPropertyOverrideAccessDTO.Write, ModelPropertyOverrideAccessDTO.Notify],
    values: [{ value: 1, description: 'Sweeping' }, { value: 2, description: 'Vacuuming' }],
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z')
});

describe('ModelPropertyOverrideMapper', () => {
    let mapper: ModelPropertyOverrideMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<ModelPropertyOverrideMapper>(ModelPropertyOverrideMapper);
    });
    afterEach(PlatformTest.reset);

    describe('mapDTOToModel', () => {
        it('maps the stored override, its access enum and values into the domain model', async () => {
            expect.assertions(4);
            const stored = dto();

            const override = await mapper.mapDTOToModel(stored);

            expect(override).toBeInstanceOf(ModelPropertyOverride);
            expect(override).toMatchObject({
                id: stored.id,
                model: stored.model,
                key: stored.key,
                siid: stored.siid,
                piid: stored.piid,
                createdAt: stored.createdAt,
                updatedAt: stored.updatedAt
            });
            expect(override.access).toEqual([PropertyAccess.Read, PropertyAccess.Write, PropertyAccess.Notify]);
            expect(override.values.every(value => value instanceof MiotPropertyValue)).toBe(true);
        });
    });

    describe('mapModelToCreateDTO', () => {
        it('maps the access enum back and leaves id and timestamps to the repository', async () => {
            expect.assertions(1);
            const override = await mapper.mapDTOToModel(dto());

            const created = await mapper.mapModelToCreateDTO(override);

            expect({ ...created }).toEqual({
                model: 'xiaomi.vacuum.c102gl',
                key: 'sweep-mode',
                siid: 2,
                piid: 6,
                access: [ModelPropertyOverrideAccessDTO.Read, ModelPropertyOverrideAccessDTO.Write, ModelPropertyOverrideAccessDTO.Notify],
                values: [{ value: 1, description: 'Sweeping' }, { value: 2, description: 'Vacuuming' }]
            });
        });
    });
});
