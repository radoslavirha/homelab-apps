import { createServer, type AddressInfo, type Server, type Socket } from 'node:net';
import { PlatformTest } from '@tsed/platform-http/testing';
import type { MqttClient } from 'mqtt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../services/ConfigService.js';
import { MqttClientProvider } from './MqttClientProvider.js';

/** MQTT 5 CONNACK: flags 0, the given reason code, no properties. */
const connack = (reasonCode: number): Buffer => Buffer.from([0x20, 0x03, 0x00, reasonCode, 0x00]);

/** 0x88 Server unavailable — what a broker answers while it is still coming up. */
const SERVER_UNAVAILABLE = 0x88;

describe('MqttClientProvider', () => {
    let broker: Server;
    let sockets: Socket[];
    let connects: number;
    let refuseConnect: number;

    beforeEach(async () => {
        sockets = [];
        connects = 0;
        refuseConnect = 2;
        broker = createServer((socket) => {
            sockets.push(socket);
            socket.once('data', () => {
                connects++;
                socket.write(connack(connects === refuseConnect ? SERVER_UNAVAILABLE : 0x00));
            });
            socket.on('error', () => undefined);
        });
        await new Promise<void>((resolve) => broker.listen(0, '127.0.0.1', resolve));
        const { port } = broker.address() as AddressInfo;

        // The provider factory reads config while the container is built, so the getter is
        // spied on the prototype before `PlatformTest.create`, delegating to the real one.
        const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ConfigService.prototype), 'config')!.get!;
        vi.spyOn(ConfigService.prototype, 'config', 'get').mockImplementation(function (this: ConfigService) {
            return {
                ...original.call(this),
                mqtt: { enabled: true, url: `mqtt://127.0.0.1:${port}`, username: 'u', password: 'p' }
            };
        });
        await PlatformTest.create();
    });

    afterEach(async () => {
        await PlatformTest.reset();
        vi.restoreAllMocks();
        sockets.forEach((socket) => socket.destroy());
        await new Promise<void>((resolve) => broker.close(() => resolve()));
    });

    describe('after bootstrap', () => {
        it('Should reconnect when the broker refuses one CONNACK during a roll', async () => {
            expect.assertions(2);
            const client = PlatformTest.get<MqttClient>(MqttClientProvider);
            expect(client.connected).toBe(true);

            // Broker roll: the live link drops, the first reconnect lands while the broker is
            // still starting and is refused, the broker is up for every attempt after that.
            sockets[0].destroy();
            await vi.waitFor(() => {
                if (client.connected) {
                    throw new Error('link still up');
                }
            }, { timeout: 2_000, interval: 50 });

            await vi.waitFor(() => {
                if (!client.connected) {
                    throw new Error(`not reconnected after ${connects} CONNECT(s)`);
                }
            }, { timeout: 16_000, interval: 250 }).catch(() => undefined);

            expect({ connected: client.connected, connects }).toEqual({ connected: true, connects: 3 });
        }, 20_000);
    });
});
