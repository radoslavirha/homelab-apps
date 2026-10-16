import { PlatformTest } from '@tsed/platform-http/testing';
import { ObjectUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeviceCache } from '../models/DeviceCache.js';
import { MiotSpecV2, MiotSpecV2PropertyAccess } from '../models/miot-spec-v2/index.js';
import { DeviceMongoDTO } from '../storage/device-mongo/dto/DeviceMongoDTO.js';
import { VACUUM_SPEC } from '../test/vacuumSpec.js';
import { MongoDeviceMapper } from './MongoDeviceMapper.js';

const document = (): DeviceMongoDTO => {
    const mongo = new DeviceMongoDTO();
    mongo._id = '671b00000000000000000001';
    mongo.createdAt = new Date('2026-04-01T00:00:00Z');
    mongo.updatedAt = new Date('2026-04-02T00:00:00Z');
    mongo.deviceId = 123456789;
    mongo.address = '192.168.1.50';
    mongo.token = 'ffffffffffffffffffffffffffffffff';
    mongo.stamp = 42;
    mongo.modelName = 'xiaomi.vacuum.c102gl';
    mongo.specURL = 'https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1';
    mongo.stampUpdatedAt = 1760000000000;
    // Stored as the plain JSON miot-spec.org returned.
    mongo.rawSpec = ObjectUtils.cloneDeep(VACUUM_SPEC);
    return mongo;
};

describe('MongoDeviceMapper', () => {
    let mapper: MongoDeviceMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<MongoDeviceMapper>(MongoDeviceMapper);
    });
    afterEach(PlatformTest.reset);

    describe('mongoToModel', () => {
        it('maps the document, reading the model from modelName and parsing the stored spec', async () => {
            expect.assertions(4);
            const mongo = document();

            const device = await mapper.mongoToModel(mongo);

            expect(device).toBeInstanceOf(DeviceCache);
            expect(device).toMatchObject({
                id: '671b00000000000000000001',
                createdAt: mongo.createdAt,
                updatedAt: mongo.updatedAt,
                deviceId: mongo.deviceId,
                address: mongo.address,
                token: mongo.token,
                stamp: mongo.stamp,
                model: 'xiaomi.vacuum.c102gl',
                specURL: mongo.specURL,
                stampUpdatedAt: mongo.stampUpdatedAt
            });
            expect(device.rawSpec).toBeInstanceOf(MiotSpecV2);
            expect(device.rawSpec.services[0].properties?.[0]).toMatchObject({
                access: [MiotSpecV2PropertyAccess.Read, MiotSpecV2PropertyAccess.Notify],
                valueList: [{ value: 1, description: 'Sweeping' }, { value: 2, description: 'Idle' }]
            });
        });

        it('reads a document stored before stampUpdatedAt existed as never refreshed', async () => {
            expect.assertions(1);
            const mongo = document();
            delete mongo.stampUpdatedAt;

            const device = await mapper.mongoToModel(mongo);

            expect(device.stampUpdatedAt).toBe(0);
        });
    });

    describe('buildMongoCreate', () => {
        it('writes the model into modelName and the spec back in its wire format', async () => {
            expect.assertions(3);
            const device = await mapper.mongoToModel(document());

            const payload = await mapper.buildMongoCreate(device);

            expect(payload).toMatchObject({ modelName: 'xiaomi.vacuum.c102gl', deviceId: 123456789, stamp: 42, stampUpdatedAt: 1760000000000 });
            expect(payload).not.toHaveProperty('model');
            expect(payload.rawSpec).toEqual(VACUUM_SPEC);
        });
    });

    describe('buildMongoUpdate', () => {
        it('writes the same fields as a create, without the base fields', async () => {
            expect.assertions(4);
            const device = await mapper.mongoToModel(document());

            const payload = await mapper.buildMongoUpdate(device);

            expect(payload).toMatchObject({ modelName: 'xiaomi.vacuum.c102gl', address: '192.168.1.50', token: device.token });
            expect(payload).not.toHaveProperty('model');
            expect(payload).not.toHaveProperty('_id');
            expect(payload.rawSpec).toEqual(VACUUM_SPEC);
        });
    });
});
