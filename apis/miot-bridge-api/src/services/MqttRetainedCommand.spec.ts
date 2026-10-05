// apis/miot-bridge-api/src/services/MqttRetainedCommand.spec.ts
import { EventEmitter } from 'events';
import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import type { IPublishPacket } from 'mqtt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandResponseModel } from '../models/CommandResponseModel.js';
import { DeviceCommandOperation } from '../models/DeviceCommandOperation.enum.js';
import { MqttClientProvider } from '../providers/MqttClientProvider.js';
import { DeviceCommandService } from './DeviceCommandService.js';
import { MqttListenerService } from './MqttListenerService.js';

class FakeMqttClient extends EventEmitter {
    public readonly subscribe = vi.fn((_pattern: string, _options: unknown, cb: (err?: Error) => void) => cb());
    public readonly publishAsync = vi.fn(async () => undefined);
    public readonly endAsync = vi.fn(async () => undefined);
}

describe('MqttListenerService — retained command messages', () => {
    let client: FakeMqttClient;
    let deviceCommandService: DeviceCommandService;

    beforeEach(async () => {
        client = new FakeMqttClient();
        await PlatformTest.create({ imports: [{ token: MqttClientProvider, use: client }] });
        deviceCommandService = PlatformTest.get<DeviceCommandService>(DeviceCommandService);
        vi.spyOn(deviceCommandService, 'execute').mockResolvedValue(CommonUtils.buildModelStrict(CommandResponseModel, {
            deviceId: 442, command: 'vacuum:start-sweep', operation: DeviceCommandOperation.Action, success: true
        }));
        PlatformTest.get<MqttListenerService>(MqttListenerService);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('does not re-execute a retained command the broker replays on every (re)subscribe', async () => {
        const payload = Buffer.from(JSON.stringify({ command: 'vacuum:start-sweep', operation: DeviceCommandOperation.Action }));
        // What the broker sends right after SUBSCRIBE when a command was once published with retain=true —
        // on every pod start and, since the listener re-subscribes on each `connect`, on every reconnect.
        const retained = { qos: 1, retain: true } as IPublishPacket;

        client.emit('message', 'miot-bridge/device/442/command', payload, retained); // pod start
        client.emit('connect');
        client.emit('message', 'miot-bridge/device/442/command', payload, retained); // after a broker blip
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(deviceCommandService.execute).not.toHaveBeenCalled();
    });
});
