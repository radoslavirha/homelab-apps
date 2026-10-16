import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeviceNotification } from '../models/notifications/DeviceNotification.js';
import { DeviceNotificationMongoDTO } from '../storage/notification-mongo/dto/DeviceNotificationMongoDTO.js';
import { MongoNotificationMapper } from './MongoNotificationMapper.js';

const document = (): DeviceNotificationMongoDTO => {
    const mongo = new DeviceNotificationMongoDTO();
    mongo._id = '671b00000000000000000002';
    mongo.createdAt = new Date('2026-04-01T00:00:00Z');
    mongo.updatedAt = new Date('2026-04-02T00:00:00Z');
    mongo.deviceId = '671b00000000000000000001';
    mongo.property = 'vacuum:status';
    return mongo;
};

describe('MongoNotificationMapper', () => {
    let mapper: MongoNotificationMapper;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<MongoNotificationMapper>(MongoNotificationMapper);
    });
    afterEach(PlatformTest.reset);

    describe('mongoToModel', () => {
        it('maps _id to id and keeps the subscription and timestamps', () => {
            const mongo = document();

            const notification = mapper.mongoToModel(mongo);

            expect(notification).toBeInstanceOf(DeviceNotification);
            expect({ ...notification }).toEqual({
                id: '671b00000000000000000002',
                createdAt: mongo.createdAt,
                updatedAt: mongo.updatedAt,
                deviceId: mongo.deviceId,
                property: mongo.property
            });
        });
    });

    describe('buildMongoCreate', () => {
        it('writes only the subscription', () => {
            const notification = CommonUtils.buildModelStrict(DeviceNotification, {
                id: '671b00000000000000000002',
                createdAt: new Date('2026-04-01T00:00:00Z'),
                updatedAt: new Date('2026-04-02T00:00:00Z'),
                deviceId: '671b00000000000000000001',
                property: 'vacuum:status'
            });

            const payload = mapper.buildMongoCreate(notification);

            expect({ ...payload }).toEqual({ deviceId: '671b00000000000000000001', property: 'vacuum:status' });
        });
    });
});
