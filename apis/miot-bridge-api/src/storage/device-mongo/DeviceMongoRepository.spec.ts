import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceMongoDTO } from './dto/DeviceMongoDTO.js';
import { DeviceMongoRepository } from './DeviceMongoRepository.js';

// Any query reaching Mongoose with a malformed id would throw a CastError — the guard must stop it first.
const model = {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn()
};

describe('DeviceMongoRepository', () => {
    let repository: DeviceMongoRepository;

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        repository = await PlatformTest.invoke<DeviceMongoRepository>(DeviceMongoRepository, [
            { token: DeviceMongoDTO, use: model }
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

        it('updateById resolves null without querying', async () => {
            expect.assertions(2);
            await expect(repository.updateById('not-an-id', { address: '192.168.1.10' })).resolves.toBeNull();
            expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('deleteById is a no-op', async () => {
            expect.assertions(2);
            await expect(repository.deleteById('not-an-id')).resolves.toBeUndefined();
            expect(model.findByIdAndDelete).not.toHaveBeenCalled();
        });
    });
});
