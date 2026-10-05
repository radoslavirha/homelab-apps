import type { AxiosInstance } from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { PlatformTest } from '@tsed/platform-http/testing';
import { HttpProviderService } from '@radoslavirha/tsed-http-provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
import '../../providers/HttpProviderProvider.js';
import { ChmiRadarEndpoint } from './ChmiRadarEndpoint.js';

const MockAdapter = AxiosMockAdapter as unknown as new (
    instance: AxiosInstance,
    options?: Record<string, unknown>
) => AxiosMockAdapter;

describe('ChmiRadarEndpoint', () => {
    let endpoint: ChmiRadarEndpoint;
    let mock: AxiosMockAdapter;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        endpoint = PlatformTest.get<ChmiRadarEndpoint>(ChmiRadarEndpoint);
        const httpProvider = PlatformTest.get<HttpProviderService<ExternalApi>>(HttpProviderService);
        mock = new MockAdapter((httpProvider.get(ExternalApi.ChmiOpendata) as { raw: unknown }).raw as AxiosInstance);
        // 08:25:05 UTC — observed on opendata.chmi.cz 2026-10-05: the 0825 file
        // answered 404 at 08:25:01 and 200 at 08:25:12; 0820 was already up.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-05T08:25:05Z'));
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.useRealTimers());

    it('returns the current slot when published', async () => {
        expect.assertions(1);
        mock.onGet(/z_max3d\.20261005\.0825\.0\.png$/).reply(200, Buffer.from('radar-0825'));

        const result = await endpoint.getCurrentRadarSituation();

        expect(Buffer.from(result).toString()).toBe('radar-0825');
    });

    it('returns the latest published composite while the current slot is not yet published', async () => {
        expect.assertions(1);
        mock.onGet(/z_max3d\.20261005\.0825\.0\.png$/).reply(404);
        mock.onGet(/z_max3d\.20261005\.0820\.0\.png$/).reply(200, Buffer.from('radar-0820'));

        const result = await endpoint.getCurrentRadarSituation();

        expect(Buffer.from(result).toString()).toBe('radar-0820');
    });

    it('gives up after the fallback slots are all missing', async () => {
        expect.assertions(1);
        mock.onGet().reply(404);

        await expect(endpoint.getCurrentRadarSituation()).rejects.toThrow(/404/);
    });

    it('does not fall back on other errors', async () => {
        expect.assertions(2);
        mock.onGet(/0825\.0\.png$/).reply(500);

        await expect(endpoint.getCurrentRadarSituation()).rejects.toThrow(/500/);
        expect(mock.history.get).toHaveLength(1);
    });
});
