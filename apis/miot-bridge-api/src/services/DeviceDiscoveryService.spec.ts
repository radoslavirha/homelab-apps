import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiotSpecV2Endpoint } from '../endpoints/miot-spec-v2/MiotSpecV2Endpoint.js';
import { MiotSpecV2InstancesDTO } from '../endpoints/miot-spec-v2/dto/MiotSpecV2InstancesDTO.js';
import { DeviceDiscoveryService } from './DeviceDiscoveryService.js';

const INSTANCES = {
    instances: [
        { model: 'xiaomi.vacuum.c102gl', type: 'urn:old', ts: 100, version: 1 },
        { model: 'xiaomi.vacuum.c102gl', type: 'urn:new', ts: 200, version: 2 },
        { model: 'other.device.v1', type: 'urn:other', ts: 300, version: 1 }
    ]
} as MiotSpecV2InstancesDTO;

describe('DeviceDiscoveryService', () => {
    let service: DeviceDiscoveryService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        vi.spyOn(PlatformTest.get<MiotSpecV2Endpoint>(MiotSpecV2Endpoint), 'fetchInstances').mockResolvedValue(INSTANCES);
        service = PlatformTest.get<DeviceDiscoveryService>(DeviceDiscoveryService);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('findLatestInstance', () => {
        it('returns the newest instance of the model', async () => {
            const instance = await service.findLatestInstance('xiaomi.vacuum.c102gl');

            expect(instance.type).toBe('urn:new');
        });

        it('throws a 400 when the model is absent from the registry', async () => {
            await expect(service.findLatestInstance('unknown.model.v9')).rejects.toMatchObject({
                status: 400,
                message: 'Model unknown.model.v9 not found in MIoT spec'
            });
        });
    });
});
