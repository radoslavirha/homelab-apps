import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MiotSpecV2 } from '../models/miot-spec-v2/index.js';
import { MiotSpecV2PropertyAccess } from '../models/miot-spec-v2/index.js';
import type { ModelPropertyOverride } from '../models/model-property-override/ModelPropertyOverride.js';
import { PropertyAccess } from '../models/simplified-miot-spec/PropertyAccess.enum.js';
import { MIOT_PROPERTY_SOURCE_VALUE_OVERRIDE, MIOT_PROPERTY_SOURCE_VALUE_SPEC } from '../otel/telemetry.js';
import { SimplifiedMiotSpecV2Mapper } from './SimplifiedMiotSpecV2Mapper.js';

const PUBLISHED_KEY = 'vacuum:status';
/** The override table stores only the property half; the mapper prefixes the service key. */
const OVERRIDE_PROPERTY = 'sweep-mode';
const OVERRIDE_KEY = `vacuum:${OVERRIDE_PROPERTY}`;

const rawSpec = (): MiotSpecV2 =>
    ({
        type: 'urn:miot-spec-v2:device:vacuum:0000A006',
        description: 'Robot Cleaner',
        services: [
            {
                iid: 2,
                type: 'urn:miot-spec-v2:service:vacuum:00007810',
                description: 'Robot Cleaner',
                properties: [
                    {
                        iid: 1,
                        type: 'urn:miot-spec-v2:property:status:00000007',
                        description: 'Status',
                        access: [MiotSpecV2PropertyAccess.Read, MiotSpecV2PropertyAccess.Notify],
                        valueList: [{ value: 1, description: 'Sweeping' }]
                    }
                ]
            }
        ]
    }) as MiotSpecV2;

const override = (key: string): ModelPropertyOverride =>
    ({
        model: 'xiaomi.vacuum.c102gl',
        key,
        siid: 2,
        piid: 9,
        access: [PropertyAccess.Read, PropertyAccess.Write],
        values: [{ value: 0, description: 'Sweep' }]
    }) as ModelPropertyOverride;

describe('SimplifiedMiotSpecV2Mapper', () => {
    let mapper: SimplifiedMiotSpecV2Mapper;

    beforeEach(async () => {
        await PlatformTest.create();
        mapper = PlatformTest.get<SimplifiedMiotSpecV2Mapper>(SimplifiedMiotSpecV2Mapper);
    });

    afterEach(PlatformTest.reset);

    it('Should mark a published property as coming from the spec', async () => {
        const spec = await mapper.map(rawSpec());

        expect(spec.properties.get(PUBLISHED_KEY)?.source).toBe(MIOT_PROPERTY_SOURCE_VALUE_SPEC);
    });

    // The device's published spec is incomplete, so these entries exist precisely because nobody
    // upstream vouches for them. When the device refuses one, the blame is ours — which is only
    // answerable if the provenance is recorded at the moment the entry is inserted.
    it('Should mark an unpublished property as coming from an override', async () => {
        const spec = await mapper.map(rawSpec(), [override(OVERRIDE_PROPERTY)]);

        expect(spec.properties.get(OVERRIDE_KEY)?.source).toBe(MIOT_PROPERTY_SOURCE_VALUE_OVERRIDE);
        expect(spec.properties.get(PUBLISHED_KEY)?.source).toBe(MIOT_PROPERTY_SOURCE_VALUE_SPEC);
    });

    // The case that makes reconstructing provenance later impossible: the key exists in both, and
    // the merged map keeps no record of who won. Whoever ended up in the map is who gets blamed.
    it('Should mark a published property replaced by an override as ours', async () => {
        const spec = await mapper.map(rawSpec(), [override(PUBLISHED_KEY.split(':')[1])]);

        const property = spec.properties.get(PUBLISHED_KEY);

        expect(property?.source).toBe(MIOT_PROPERTY_SOURCE_VALUE_OVERRIDE);
        expect(property?.piid).toBe(9);
    });

    describe('Services sharing a service type', () => {
        const switchService = (iid: number) => ({
            iid,
            type: 'urn:miot-spec-v2:service:switch:0000780C:lumi-b2nacn02:1',
            description: iid === 2 ? 'Left Switch' : 'Right Switch',
            properties: [
                {
                    iid: 1,
                    type: 'urn:miot-spec-v2:property:on:00000006:lumi-b2nacn02:1',
                    description: 'Switch Status',
                    format: 'bool',
                    access: [MiotSpecV2PropertyAccess.Read, MiotSpecV2PropertyAccess.Write, MiotSpecV2PropertyAccess.Notify]
                }
            ]
        });
        const twoGang = {
            type: 'urn:miot-spec-v2:device:switch:0000A003:lumi-b2nacn02:1',
            description: 'Two-gang wall switch',
            services: [switchService(2), switchService(3)]
        } as MiotSpecV2;

        it('Should keep properties of two services that share a service type addressable', async () => {
            const spec = await mapper.map(twoGang);

            const siids = [...spec.properties.values()].map(p => p.siid);
            expect(siids).toEqual(expect.arrayContaining([2, 3]));
        });

        it('Should key repeated service types by siid and leave unique ones untouched', async () => {
            const spec = await mapper.map(twoGang);

            expect(spec.properties.get('switch-2:on')?.siid).toBe(2);
            expect(spec.properties.get('switch-3:on')?.siid).toBe(3);
            expect(spec.properties.has('switch:on')).toBe(false);
        });

        it('Should apply an override to the service it names', async () => {
            const spec = await mapper.map(twoGang, [{ ...override(OVERRIDE_PROPERTY), siid: 2 } as ModelPropertyOverride]);

            expect(spec.properties.get(`switch-2:${OVERRIDE_PROPERTY}`)?.source).toBe(MIOT_PROPERTY_SOURCE_VALUE_OVERRIDE);
            expect(spec.properties.has(`switch-3:${OVERRIDE_PROPERTY}`)).toBe(false);
        });
    });

    describe('repeated property and action types within one service', () => {
        const access = [MiotSpecV2PropertyAccess.Read, MiotSpecV2PropertyAccess.Write];
        const property = (iid: number, type: string) => ({ iid, type: `urn:miot-spec-v2:property:${type}:00000008:xinji-sw1a02:1`, description: type, format: 'uint8', access });
        const action = (iid: number, inputs: number[] = []) => ({ iid, type: 'urn:miot-spec-v2:action:reset-filter-life:00002803:xiaomi-ua3:1', description: 'Reset', in: inputs, out: [] });
        const deviceOf = (service: Record<string, unknown>) => ({
            type: 'urn:miot-spec-v2:device:switch:0000A003:xinji-sw1a02:1',
            description: 'Switch',
            services: [{ iid: 2, type: 'urn:miot-spec-v2:service:switch:0000780C:xinji-sw1a02:1', description: 'Switch', ...service }]
        }) as unknown as MiotSpecV2;

        it('Should keep both properties of one service that share a property type addressable', async () => {
            expect.assertions(3);
            const spec = await mapper.map(deviceOf({ properties: [property(2, 'mode'), property(6, 'mode'), property(1, 'on')] }));

            expect(spec.properties.get('switch:mode-2')?.piid).toBe(2);
            expect(spec.properties.get('switch:mode-6')?.piid).toBe(6);
            expect(spec.properties.get('switch:on')?.piid).toBe(1);
        });

        it('Should keep every action of one service that share an action type addressable', async () => {
            expect.assertions(1);
            const spec = await mapper.map(deviceOf({ properties: [], actions: [action(1), action(2), action(3)] }));

            expect([...spec.actions.values()].map(a => a.aiid)).toEqual(expect.arrayContaining([1, 2, 3]));
        });

        it('Should point an action input at the disambiguated key of its property', async () => {
            expect.assertions(1);
            const spec = await mapper.map(deviceOf({ properties: [property(2, 'mode'), property(6, 'mode')], actions: [action(1, [6])] }));

            expect([...spec.actions.values()][0].in).toEqual(['switch:mode-6']);
        });
    });

    it('Should skip an override whose service does not exist in the spec', async () => {
        const orphan = { ...override(OVERRIDE_PROPERTY), siid: 99 } as ModelPropertyOverride;

        const spec = await mapper.map(rawSpec(), [orphan]);

        expect(spec.properties.has(OVERRIDE_KEY)).toBe(false);
    });
});
