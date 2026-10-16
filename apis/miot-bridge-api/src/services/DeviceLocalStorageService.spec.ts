import { PlatformTest } from '@tsed/platform-http/testing';
import { Serializer } from '@radoslavirha/tsed-common';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiotSpecV2DTO } from '../endpoints/miot-spec-v2/dto/index.js';
import { FileDeviceMapper } from '../mappers/FileDeviceMapper.js';
import { DeviceCache } from '../models/DeviceCache.js';
import { DeviceLocalStorageRepository } from '../storage/device-local-storage/DeviceLocalStorageRepository.js';
import { DeviceLocalStorageDTO } from '../storage/device-local-storage/dto/DeviceLocalStorageDTO.js';
import { VACUUM_SPEC } from '../test/vacuumSpec.js';
import { DeviceLocalStorageService } from './DeviceLocalStorageService.js';

const stored = (id: string, deviceId: number): DeviceLocalStorageDTO => CommonUtils.buildModelStrict(DeviceLocalStorageDTO, {
    id,
    deviceId,
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

const FIRST = stored('7d0f5e4c-0b8a-4a8e-9a57-1d2c3b4a5f60', 1);
const SECOND = stored('8e1a6f5d-1c9b-4b9f-8b68-2e3d4c5b6a71', 2);

describe('DeviceLocalStorageService', () => {
    let service: DeviceLocalStorageService;
    let repository: DeviceLocalStorageRepository;

    const toDomain = (dto: DeviceLocalStorageDTO): Promise<DeviceCache> =>
        PlatformTest.get<FileDeviceMapper>(FileDeviceMapper).mapDTOToModel(dto);

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<DeviceLocalStorageService>(DeviceLocalStorageService);
        repository = PlatformTest.get<DeviceLocalStorageRepository>(DeviceLocalStorageRepository);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('getAll', () => {
        it('maps every stored device', async () => {
            expect.assertions(2);
            vi.spyOn(repository, 'getAll').mockResolvedValue([FIRST, SECOND]);

            const devices = await service.getAll();

            expect(devices.every(device => device instanceof DeviceCache)).toBe(true);
            expect(devices.map(device => device.id)).toEqual([FIRST.id, SECOND.id]);
        });
    });

    describe('getById', () => {
        it('maps the stored device', async () => {
            expect.assertions(2);
            const getById = vi.spyOn(repository, 'getById').mockResolvedValue(SECOND);

            const device = await service.getById(SECOND.id);

            expect(getById).toHaveBeenCalledWith(SECOND.id);
            expect(device).toMatchObject({ id: SECOND.id, deviceId: 2 });
        });

        it('returns undefined when nothing is stored under the id', async () => {
            expect.assertions(1);
            vi.spyOn(repository, 'getById').mockResolvedValue(undefined);

            await expect(service.getById(SECOND.id)).resolves.toBeUndefined();
        });
    });

    describe('getByDeviceId', () => {
        it('maps the stored device', async () => {
            expect.assertions(2);
            const getByDeviceId = vi.spyOn(repository, 'getByDeviceId').mockResolvedValue(SECOND);

            const device = await service.getByDeviceId(2);

            expect(getByDeviceId).toHaveBeenCalledWith(2);
            expect(device).toMatchObject({ id: SECOND.id, deviceId: 2 });
        });

        it('returns undefined when the hardware id is not registered', async () => {
            expect.assertions(1);
            vi.spyOn(repository, 'getByDeviceId').mockResolvedValue(undefined);

            await expect(service.getByDeviceId(2)).resolves.toBeUndefined();
        });
    });

    describe('create', () => {
        it('stores the device without id or timestamps and returns what was stored', async () => {
            expect.assertions(3);
            const create = vi.spyOn(repository, 'create').mockResolvedValue(SECOND);

            const created = await service.create(await toDomain(FIRST));

            const [written] = create.mock.calls[0];
            expect(written).not.toHaveProperty('id');
            expect(written).toMatchObject({ deviceId: FIRST.deviceId, model: FIRST.model });
            expect(created).toMatchObject({ id: SECOND.id });
        });
    });

    describe('update', () => {
        it('stores the whole device and returns what was stored', async () => {
            expect.assertions(2);
            const device = await toDomain(FIRST);
            device.address = '192.168.1.51';
            const update = vi.spyOn(repository, 'update').mockResolvedValue({ ...FIRST, address: '192.168.1.51' });

            const result = await service.update(device);

            expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: FIRST.id, address: '192.168.1.51', rawSpec: FIRST.rawSpec }));
            expect(result).toMatchObject({ id: FIRST.id, address: '192.168.1.51' });
        });
    });

    describe('delete', () => {
        it('deletes by id', async () => {
            expect.assertions(1);
            const remove = vi.spyOn(repository, 'delete').mockResolvedValue(undefined);

            await service.delete(FIRST.id);

            expect(remove).toHaveBeenCalledWith(FIRST.id);
        });
    });
});
