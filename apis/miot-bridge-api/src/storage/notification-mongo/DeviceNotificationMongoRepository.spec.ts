import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceNotificationMongoDTO } from './dto/DeviceNotificationMongoDTO.js';
import { DeviceNotificationMongoRepository } from './DeviceNotificationMongoRepository.js';

// Any query reaching Mongoose with a malformed id would throw a CastError — the guard must stop it first.
const model = {
    findById: vi.fn(),
    findByIdAndDelete: vi.fn()
};

describe('DeviceNotificationMongoRepository', () => {
    let repository: DeviceNotificationMongoRepository;

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        repository = await PlatformTest.invoke<DeviceNotificationMongoRepository>(DeviceNotificationMongoRepository, [
            { token: DeviceNotificationMongoDTO, use: model }
        ]);
    });
    afterEach(() => {
        vi.clearAllMocks();
        return PlatformTest.reset();
    });

    describe('with a malformed id', () => {
        it('findById resolves null without querying', async () => {
            expect.assertions(2);
            await expect(repository.findById('not-an-id')).resolves.toBeNull();
            expect(model.findById).not.toHaveBeenCalled();
        });

        it('deleteById is a no-op', async () => {
            expect.assertions(2);
            await expect(repository.deleteById('not-an-id')).resolves.toBeUndefined();
            expect(model.findByIdAndDelete).not.toHaveBeenCalled();
        });
    });
});
