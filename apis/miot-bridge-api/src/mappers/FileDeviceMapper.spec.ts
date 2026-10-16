import { PlatformTest } from '@tsed/platform-http/testing';
import { Serializer } from '@radoslavirha/tsed-common';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MiotSpecV2DTO } from '../endpoints/miot-spec-v2/dto/index.js';
import { DeviceCache } from '../models/DeviceCache.js';
import { MiotSpecV2, MiotSpecV2PropertyAccess } from '../models/miot-spec-v2/index.js';
import { DeviceLocalStorageDTO } from '../storage/device-local-storage/dto/DeviceLocalStorageDTO.js';
import { VACUUM_SPEC } from '../test/vacuumSpec.js';
import { FileDeviceMapper } from './FileDeviceMapper.js';

const dto = (): DeviceLocalStorageDTO => CommonUtils.buildModelStrict(DeviceLocalStorageDTO, {
    id: '7d0f5e4c-0b8a-4a8e-9a57-1d2c3b4a5f60',
    deviceId: 123456789,
    address: '192.168.1.50',
    token: 'ffffffffffffffffffffffffffffffff',
    stamp: 42,
    model: 'xiaomi.vacuum.c102gl',
    specURL: 'https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1',
    rawSpec: Serializer.deserialize<MiotSpecV2DTO>(VACUUM_SPEC, MiotSpecV2DTO),
    stampUpdatedAt: 1760000000000,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z')
});

describe('FileDeviceMapper', () => {
    let mapper: FileDeviceMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<FileDeviceMapper>(FileDeviceMapper);
    });
    afterEach(PlatformTest.reset);

    describe('mapDTOToModel', () => {
        it('copies the stored fields and maps the raw spec into its domain model', async () => {
            expect.assertions(4);
            const stored = dto();

            const device = await mapper.mapDTOToModel(stored);

            expect(device).toBeInstanceOf(DeviceCache);
            expect(device).toMatchObject({
                id: stored.id,
                deviceId: stored.deviceId,
                address: stored.address,
                token: stored.token,
                stamp: stored.stamp,
                model: stored.model,
                specURL: stored.specURL,
                stampUpdatedAt: stored.stampUpdatedAt,
                createdAt: stored.createdAt,
                updatedAt: stored.updatedAt
            });
            expect(device.rawSpec).toBeInstanceOf(MiotSpecV2);
            expect(device.rawSpec.services[0].properties?.[0].access).toEqual([MiotSpecV2PropertyAccess.Read, MiotSpecV2PropertyAccess.Notify]);
        });
    });

    describe('mapModelToDTO', () => {
        it('round-trips a stored device, raw spec included', async () => {
            expect.assertions(2);
            const stored = dto();

            const written = await mapper.mapModelToDTO(await mapper.mapDTOToModel(stored));

            expect(written).toEqual(stored);
            expect(Serializer.serialize(written.rawSpec, MiotSpecV2DTO)).toEqual(VACUUM_SPEC);
        });
    });

    describe('mapModelToCreateDTO', () => {
        it('leaves id and timestamps for the repository to assign', async () => {
            expect.assertions(4);
            const device = await mapper.mapDTOToModel(dto());

            const created = await mapper.mapModelToCreateDTO(device);

            expect(created).not.toHaveProperty('id');
            expect(created).not.toHaveProperty('createdAt');
            expect(created).not.toHaveProperty('updatedAt');
            expect(created).toMatchObject({ deviceId: device.deviceId, model: device.model, stamp: device.stamp, stampUpdatedAt: device.stampUpdatedAt });
        });
    });
});
