import type { AxiosInstance } from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { PlatformTest } from '@tsed/platform-http/testing';
import { HttpProviderService } from '@radoslavirha/tsed-http-provider';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
// registers the HttpProviderService override bound to this API's config
import '../../providers/HttpProviderProvider.js';
import { MiotSpecV2Endpoint } from './MiotSpecV2Endpoint.js';

const MockAdapter = AxiosMockAdapter as unknown as new (
    instance: AxiosInstance,
    options?: Record<string, unknown>
) => AxiosMockAdapter;

/** The transport behind a client — tests mock at this level. */
const transportOf = (client: { raw: unknown }): AxiosInstance => client.raw as AxiosInstance;

const BASE_URL = 'https://miot-spec.org/miot-spec-v2';

const INSTANCES = [
    { model: 'xiaomi.vacuum.c102gl', type: 'urn:new', ts: 200 },
    { model: 'xiaomi.vacuum.c102gl', type: 'urn:old', ts: 100 },
    { model: 'other.device.v1', type: 'urn:other', ts: 300 }
];

describe('MiotSpecV2Endpoint', () => {
    let endpoint: MiotSpecV2Endpoint;
    let mock: AxiosMockAdapter;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        endpoint = PlatformTest.get<MiotSpecV2Endpoint>(MiotSpecV2Endpoint);
        const httpProvider = PlatformTest.get<HttpProviderService<ExternalApi>>(HttpProviderService);
        mock = new MockAdapter(transportOf(httpProvider.get(ExternalApi.MiotSpec)));
    });
    afterEach(PlatformTest.reset);

    it('builds an absolute spec URL from the configured base URL', () => {
        expect(endpoint.specUrl('urn:new')).toBe(`${BASE_URL}/instance?type=urn:new`);
    });

    it('fetches the released instances', async () => {
        expect.assertions(2);
        mock.onGet('/instances').reply(200, { instances: INSTANCES });

        const { instances } = await endpoint.fetchInstances();

        expect(instances.map(i => i.type)).toEqual(['urn:new', 'urn:old', 'urn:other']);
        // only released instances are requested
        expect(mock.history['get']?.[0]?.params).toEqual({ status: 'released' });
    });

    it('fetches the spec of an instance by type', async () => {
        expect.assertions(2);
        mock.onGet('/instance').reply(200, { type: 'urn:new', services: [] });

        const spec = await endpoint.fetchSpec('urn:new');

        expect(spec.type).toBe('urn:new');
        expect(mock.history['get']?.[0]?.params).toEqual({ type: 'urn:new' });
    });
});
