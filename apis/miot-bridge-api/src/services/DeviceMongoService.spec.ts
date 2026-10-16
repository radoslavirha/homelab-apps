import { PlatformTest } from '@tsed/platform-http/testing';
import { NotFound } from '@tsed/exceptions';
import { ObjectUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoDeviceMapper } from '../mappers/MongoDeviceMapper.js';
import { DeviceCache } from '../models/DeviceCache.js';
import { DeviceMongoRepository } from '../storage/device-mongo/DeviceMongoRepository.js';
import { DeviceMongoDTO } from '../storage/device-mongo/dto/DeviceMongoDTO.js';
import { VACUUM_SPEC } from '../test/vacuumSpec.js';
import { DeviceMongoService } from './DeviceMongoService.js';

const stored = (_id: string, deviceId: number): DeviceMongoDTO => {
    const mongo = new DeviceMongoDTO();
    mongo._id = _id;
    mongo.createdAt = new Date('2026-04-01T00:00:00Z');
    mongo.updatedAt = new Date('2026-04-02T00:00:00Z');
    mongo.deviceId = deviceId;
    mongo.address = '192.168.1.50';
    mongo.token = 'ffffffffffffffffffffffffffffffff';
    mongo.stamp = 42;
    mongo.modelName = 'xiaomi.vacuum.c102gl';
    mongo.specURL = 'https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1';
    mongo.stampUpdatedAt = 1760000000000;
    mongo.rawSpec = ObjectUtils.cloneDeep(VACUUM_SPEC);
    return mongo;
};

const FIRST = stored('671b00000000000000000001', 1);
const SECOND = stored('671b00000000000000000002', 2);

describe('DeviceMongoService', () => {
    let service: DeviceMongoService;
    let repository: DeviceMongoRepository;

    const toDomain = (dto: DeviceMongoDTO): Promise<DeviceCache> =>
        PlatformTest.get<MongoDeviceMapper>(MongoDeviceMapper).mongoToModel(dto);

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<DeviceMongoService>(DeviceMongoService);
        repository = PlatformTest.get<DeviceMongoRepository>(DeviceMongoRepository);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('getAll', () => {
        it('maps every stored document', async () => {
            expect.assertions(2);
            vi.spyOn(repository, 'findAll').mockResolvedValue([FIRST, SECOND]);

            const devices = await service.getAll();

            expect(devices.every(device => device instanceof DeviceCache)).toBe(true);
            expect(devices.map(device => device.id)).toEqual([FIRST._id, SECOND._id]);
        });
    });

    describe('getById', () => {
        it('maps the stored document', async () => {
            expect.assertions(2);
            const findById = vi.spyOn(repository, 'findById').mockResolvedValue(SECOND);

            const device = await service.getById(SECOND._id);

            expect(findById).toHaveBeenCalledWith(SECOND._id);
            expect(device).toMatchObject({ id: SECOND._id, deviceId: 2, model: 'xiaomi.vacuum.c102gl' });
        });

        it('turns the repository\'s null into undefined', async () => {
            expect.assertions(1);
            vi.spyOn(repository, 'findById').mockResolvedValue(null);

            await expect(service.getById(SECOND._id)).resolves.toBeUndefined();
        });
    });

    describe('getByDeviceId', () => {
        it('maps the stored document', async () => {
            expect.assertions(2);
            const findByDeviceId = vi.spyOn(repository, 'findByDeviceId').mockResolvedValue(SECOND);

            const device = await service.getByDeviceId(2);

            expect(findByDeviceId).toHaveBeenCalledWith(2);
            expect(device).toMatchObject({ id: SECOND._id, deviceId: 2 });
        });

        it('turns the repository\'s null into undefined', async () => {
            expect.assertions(1);
            vi.spyOn(repository, 'findByDeviceId').mockResolvedValue(null);

            await expect(service.getByDeviceId(2)).resolves.toBeUndefined();
        });
    });

    describe('create', () => {
        it('stores the create payload and returns the stored document', async () => {
            expect.assertions(3);
            const create = vi.spyOn(repository, 'create').mockResolvedValue(FIRST);

            const created = await service.create(await toDomain(FIRST));

            const [payload] = create.mock.calls[0];
            expect(payload).toMatchObject({ modelName: 'xiaomi.vacuum.c102gl', deviceId: 1 });
            expect(payload).not.toHaveProperty('_id');
            expect(created).toMatchObject({ id: FIRST._id });
        });
    });

    describe('update', () => {
        it('updates the document by id and returns it', async () => {
            expect.assertions(2);
            const device = await toDomain(FIRST);
            device.address = '192.168.1.51';
            const updated = stored(FIRST._id, 1);
            updated.address = '192.168.1.51';
            const updateById = vi.spyOn(repository, 'updateById').mockResolvedValue(updated);

            const result = await service.update(device);

            expect(updateById).toHaveBeenCalledWith(FIRST._id, expect.objectContaining({ address: '192.168.1.51', modelName: 'xiaomi.vacuum.c102gl' }));
            expect(result).toMatchObject({ id: FIRST._id, address: '192.168.1.51' });
        });

        it('throws NotFound when the document is gone', async () => {
            expect.assertions(1);
            vi.spyOn(repository, 'updateById').mockResolvedValue(null);

            await expect(service.update(await toDomain(FIRST))).rejects.toBeInstanceOf(NotFound);
        });
    });

    describe('delete', () => {
        it('deletes by id', async () => {
            expect.assertions(1);
            const deleteById = vi.spyOn(repository, 'deleteById').mockResolvedValue(undefined);

            await service.delete(FIRST._id);

            expect(deleteById).toHaveBeenCalledWith(FIRST._id);
        });
    });
});
