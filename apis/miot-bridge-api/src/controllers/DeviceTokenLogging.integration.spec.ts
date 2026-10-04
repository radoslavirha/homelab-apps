import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { authenticateBearerJwt } from '@radoslavirha/tsed-auth';
import { Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { DeviceCache } from '../models/DeviceCache.js';
import { MiotSpecV2 } from '../models/miot-spec-v2/index.js';
import { Server } from '../Server.js';
import { MqttClientProvider } from '../providers/MqttClientProvider.js';
import { DeviceStorageService } from '../services/DeviceStorageService.js';

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('Device token in request logs', () => {
    let api: SuperTest.Agent;
    let emitted: ReturnType<typeof vi.fn<(message: string, meta: unknown) => void>>;

    beforeEach(PlatformTest.bootstrap(Server, { imports: [{ token: MqttClientProvider, use: null }] }));
    beforeEach(async () => {
        api = await authenticateBearerJwt(SuperTest.agent(PlatformTest.callback()));
        const logger = PlatformTest.get<Logger>(Logger) as unknown as {
            httpLog: { info: (m: string, meta: unknown) => void; error: (m: string, meta: unknown) => void };
        };
        emitted = vi.fn<(message: string, meta: unknown) => void>();
        vi.spyOn(logger.httpLog, 'info').mockImplementation(emitted);
        vi.spyOn(logger.httpLog, 'error').mockImplementation(emitted);
    });
    afterEach(PlatformTest.reset);

    const device = (): DeviceCache => CommonUtils.buildModelStrict(DeviceCache, {
        id: 'a',
        deviceId: 1,
        address: '10.0.0.2',
        token: TOKEN,
        stamp: 5,
        stampUpdatedAt: 1,
        model: 'm',
        specURL: 'u',
        createdAt: new Date(),
        updatedAt: new Date(),
        rawSpec: CommonUtils.buildModelCore(MiotSpecV2, { type: 't', description: 'd', services: [] })
    });

    it('does not log the token of a device returned by GET /devices/:id', async () => {
        vi.spyOn(PlatformTest.get<DeviceStorageService>(DeviceStorageService), 'getById').mockResolvedValue(device());

        const response = await api.get('/devices/a').expect(200);

        expect(JSON.stringify(response.body)).not.toContain(TOKEN);
        expect(emitted).toHaveBeenCalled();
        expect(JSON.stringify(emitted.mock.calls)).not.toContain(TOKEN);
    });

    it('does not log the tokens of the devices returned by GET /devices', async () => {
        vi.spyOn(PlatformTest.get<DeviceStorageService>(DeviceStorageService), 'getAll').mockResolvedValue([device()]);

        const response = await api.get('/devices').expect(200);

        expect(JSON.stringify(response.body)).not.toContain(TOKEN);
        expect(emitted).toHaveBeenCalled();
        expect(JSON.stringify(emitted.mock.calls)).not.toContain(TOKEN);
    });
});
