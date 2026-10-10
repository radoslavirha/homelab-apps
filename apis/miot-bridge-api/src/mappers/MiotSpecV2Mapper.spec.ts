import { PlatformTest } from '@tsed/platform-http/testing';
import { Serializer } from '@radoslavirha/tsed-common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MiotSpecV2DTO } from '../endpoints/miot-spec-v2/dto/index.js';
import { MiotSpecV2PropertyFormat } from '../models/miot-spec-v2/index.js';
import { MiotSpecV2Mapper } from './MiotSpecV2Mapper.js';

/**
 * Trimmed from the released miot-spec.org instance
 * `urn:miot-spec-v2:device:temperature-humidity-sensor:0000A00A:miaomiaoce-t2:1` — temperature and
 * humidity are published with `format: "float"`.
 */
const floatSpec = {
    type: 'urn:miot-spec-v2:device:temperature-humidity-sensor:0000A00A:miaomiaoce-t2:1',
    description: 'Temperature Humidity Sensor',
    services: [
        {
            iid: 2,
            type: 'urn:miot-spec-v2:service:temperature-humidity-sensor:00007814:miaomiaoce-t2:1',
            description: 'Temperature Humidity Sensor',
            properties: [
                {
                    iid: 1,
                    type: 'urn:miot-spec-v2:property:temperature:00000020:miaomiaoce-t2:1',
                    description: 'Temperature',
                    format: 'float',
                    access: ['read', 'notify'],
                    unit: 'celsius',
                    'value-range': [-30, 100, 0.1]
                }
            ]
        }
    ]
};

describe('MiotSpecV2Mapper', () => {
    let mapper: MiotSpecV2Mapper;

    beforeEach(async () => {
        await PlatformTest.create();
        mapper = PlatformTest.get<MiotSpecV2Mapper>(MiotSpecV2Mapper);
    });

    afterEach(PlatformTest.reset);

    it('Should map a spec that publishes a float property', async () => {
        const dto = Serializer.deserialize<MiotSpecV2DTO>(floatSpec, MiotSpecV2DTO);

        const spec = await mapper.mapDTOToModel(dto);

        expect(spec.services[0].properties?.[0].format).toBe(MiotSpecV2PropertyFormat.Float);
        expect(spec.services[0].properties?.[0].valueRange).toEqual([-30, 100, 0.1]);
    });
});
