import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from './ConfigService.js';
import { NotificationDispatchService } from './NotificationDispatchService.js';

describe('NotificationDispatchService HTTP sink', () => {
    beforeEach(async () => {
        await PlatformTest.create();
        const configService = PlatformTest.get<ConfigService>(ConfigService);
        vi.spyOn(configService, 'config', 'get').mockReturnValue({
            ...configService.config,
            http: { notifications: { enabled: true, address: 'http://loxone.home:5001/notify' } }
        } as typeof configService.config);
    });

    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('Should bound the notification POST with a timeout signal', () => {
        const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
        vi.stubGlobal('fetch', fetchMock);

        PlatformTest.get<NotificationDispatchService>(NotificationDispatchService).receive({
            deviceId: 'd',
            miotDeviceId: 1,
            property: 'vacuum:status',
            oldValue: 'a',
            newValue: 'b',
            timestamp: Date.now()
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
        expect(init.signal).toBeInstanceOf(AbortSignal);
        vi.unstubAllGlobals();
    });
});
