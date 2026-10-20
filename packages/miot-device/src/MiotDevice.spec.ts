import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceClock } from './DeviceClock.js';
import { MiotDevice } from './MiotDevice.js';
import { MiotError, MIOT_ERROR_DEVICE_ERROR, MIOT_ERROR_TRANSPORT_ERROR, MIOT_METHOD_GET_PROPERTIES } from './MiotError.js';
import type { ActionResult, DiscoverResult, GetPropertiesResult, IStampStore, StampState } from './types.js';

// ---------------------------------------------------------------------------
// Mock MiotTransport — use vi.hoisted so mocks are available inside vi.mock()
// ---------------------------------------------------------------------------

const {
    mockHandshake,
    mockGetProperty,
    mockSetProperty,
    mockCallAction,
    mockGetProperties
} = vi.hoisted(() => ({
    mockHandshake: vi.fn<() => Promise<DiscoverResult>>(),
    mockGetProperty: vi.fn<(deviceId: number, clock: DeviceClock, siid: number, piid: number) => Promise<string | number | undefined>>(),
    mockSetProperty: vi.fn<() => Promise<void>>(),
    mockCallAction: vi.fn<() => Promise<ActionResult>>(),
    mockGetProperties: vi.fn<() => Promise<GetPropertiesResult[]>>()
}));

vi.mock('./MiotTransport.js', () => ({
    MiotTransport: vi.fn(function (this: Record<string, unknown>) {
        this.handshake = mockHandshake;
        this.getProperty = mockGetProperty;
        this.setProperty = mockSetProperty;
        this.callAction = mockCallAction;
        this.getProperties = mockGetProperties;
    })
}));

const TOKEN = '00112233445566778899aabbccddeeff';
const DEVICE_ID = 42;
const STAMP = 100;
const ACTION_OK: ActionResult = { code: 0, result: { did: String(DEVICE_ID), siid: 2, aiid: 1, code: 0, out: [] } };

/** Makes the mocked `getProperty` record the stamp the transport would put on its packet. */
const recordStamps = (value: string | number = 1): number[] => {
    const stamps: number[] = [];
    mockGetProperty.mockImplementation(async (_deviceId, clock) => {
        stamps.push(clock.next());
        return value;
    });
    return stamps;
};

describe('MiotDevice', () => {
    let elapsed: number;

    beforeEach(() => {
        vi.clearAllMocks();
        mockHandshake.mockResolvedValue({ deviceId: DEVICE_ID, stamp: STAMP });
        // Time stands still unless a test moves it, so no stamp depends on how fast the suite runs.
        elapsed = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => 1_000_000 + elapsed);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // discover / connect
    // -----------------------------------------------------------------------

    describe('discover()', () => {
        it('calls transport.handshake and returns deviceId + stamp', async () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            const result = await device.discover();

            expect(result.deviceId).toBe(DEVICE_ID);
            expect(result.stamp).toBe(STAMP);
        });

        it('populates deviceId after call', async () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await device.discover();

            expect(device.deviceId).toBe(DEVICE_ID);
        });

        it('seeds stamp state', async () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await device.discover();

            const state = device.getStampState();
            expect(state).toBeDefined();
            expect(state!.stamp).toBe(STAMP);
        });

        it('persists stamp to external store if configured', async () => {
            const store: IStampStore = {
                getStamp: vi.fn<() => Promise<StampState | null>>().mockResolvedValue(null),
                setStamp: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
            };
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, stampStore: store });
            await device.discover();

            expect(store.setStamp).toHaveBeenCalledWith(
                expect.objectContaining({ stamp: STAMP })
            );
        });
    });

    describe('connect()', () => {
        it('delegates to discover()', async () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await device.connect();

            expect(device.deviceId).toBe(DEVICE_ID);
            expect(mockHandshake).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // requireDeviceId guard
    // -----------------------------------------------------------------------

    describe('command methods before connect()', () => {
        it('getProperty throws "Device not connected"', async () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await expect(device.getProperty(2, 1)).rejects.toThrow('Device not connected');
        });

        it('setProperty throws "Device not connected"', async () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await expect(device.setProperty(2, 1, 'on')).rejects.toThrow('Device not connected');
        });

        it('callAction throws "Device not connected"', async () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await expect(device.callAction(2, 1)).rejects.toThrow('Device not connected');
        });

        it('getProperties throws "Device not connected"', async () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await expect(device.getProperties([{ siid: 2, piid: 1 }])).rejects.toThrow('Device not connected');
        });
    });

    // -----------------------------------------------------------------------
    // getProperty
    // -----------------------------------------------------------------------

    describe('getProperty()', () => {
        it('returns property value', async () => {
            mockGetProperty.mockResolvedValue(42);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            const value = await device.getProperty(2, 1);
            expect(value).toBe(42);
        });

        it('runs concurrent commands one at a time', async () => {
            expect.assertions(1);
            const events: string[] = [];
            mockGetProperty.mockImplementation(async (_deviceId, _clock, _siid, piid) => {
                events.push(`start ${piid}`);
                await new Promise(resolve => setTimeout(resolve, 10));
                events.push(`end ${piid}`);
                return 1;
            });

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            await Promise.all([device.getProperty(2, 1), device.getProperty(2, 2)]);

            expect(events).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
        });

        it('sends one ahead of the device clock', async () => {
            expect.assertions(2);
            const stamps = recordStamps();

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            await device.getProperty(2, 1);
            expect(stamps).toEqual([STAMP + 1]);
            expect(mockGetProperty).toHaveBeenCalledWith(DEVICE_ID, expect.any(DeviceClock), 2, 1);
        });

        // The regression behind the 10 s actions: the stamp is the device's uptime in seconds.
        // Counting calls from the handshake left it behind the clock between polls, the device
        // dropped the packet, and every such call waited out the timeout before re-handshaking.
        it('derives the stamp from the time since the handshake, not from the number of calls', async () => {
            expect.assertions(2);
            mockHandshake.mockResolvedValue({ deviceId: DEVICE_ID, stamp: 35501 });
            const stamps = recordStamps();

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await device.discover();
            await device.getProperty(2, 1);
            await device.getProperty(2, 2);
            elapsed = 17_000;
            await device.getProperty(2, 3);

            expect(stamps).toEqual([35502, 35502, 35519]);
            expect(mockHandshake).toHaveBeenCalledOnce();
        });

        it('stamps the retry from the fresh handshake', async () => {
            expect.assertions(1);
            const stamps: number[] = [];
            mockGetProperty
                .mockImplementationOnce(async (_deviceId, clock) => {
                    stamps.push(clock.next());
                    throw new Error('Command timeout');
                })
                .mockImplementationOnce(async (_deviceId, clock) => {
                    stamps.push(clock.next());
                    return 1;
                });
            mockHandshake.mockResolvedValue({ deviceId: DEVICE_ID, stamp: 35518 });

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });
            await device.getProperty(2, 1);

            expect(stamps).toEqual([STAMP + 1, 35519]);
        });

        it('retries with fresh stamp on failure', async () => {
            // First call fails, second (after handshake) succeeds
            mockGetProperty
                .mockRejectedValueOnce(new Error('Stale stamp'))
                .mockResolvedValueOnce(99);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            const value = await device.getProperty(2, 1);
            expect(value).toBe(99);
            expect(mockHandshake).toHaveBeenCalledOnce();
        });

        it('throws when retry also fails', async () => {
            mockGetProperty.mockRejectedValue(new Error('Still failing'));

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            await expect(device.getProperty(2, 1)).rejects.toThrow('Operation failed after stamp refresh');
        });

        // The retry is unconditional, so a refusal the device will repeat verbatim still goes
        // round twice. What must not happen is the code being lost on the way back out: it is the
        // only thing that separates "this property does not exist on the device" from "the device
        // is asleep", and the app puts it straight onto `rpc.response.status_code`.
        it('preserves the device error code through the stamp-refresh retry', async () => {
            mockGetProperty.mockRejectedValue(new MiotError('Device error -4004: property not exist', {
                kind: MIOT_ERROR_DEVICE_ERROR,
                method: MIOT_METHOD_GET_PROPERTIES,
                code: -4004
            }));

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            const error = await device.getProperty(2, 1).catch((err: unknown) => err);

            expect(MiotError.is(error)).toBe(true);
            expect((error as MiotError).kind).toBe(MIOT_ERROR_DEVICE_ERROR);
            expect((error as MiotError).code).toBe(-4004);
            expect((error as MiotError).method).toBe(MIOT_METHOD_GET_PROPERTIES);
            expect((error as MiotError).stampRefreshed).toBe(true);
        });

        it('does not mark a first-attempt failure as retried when there was no cached stamp', async () => {
            mockGetProperty.mockRejectedValue(new MiotError('get_properties failed: code -4004', {
                kind: MIOT_ERROR_DEVICE_ERROR,
                method: MIOT_METHOD_GET_PROPERTIES,
                code: -4004
            }));

            // No stamp state: the call goes straight to the fresh-handshake path and is sent once.
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });

            const error = await device.getProperty(2, 1).catch((err: unknown) => err);

            expect(mockGetProperty).toHaveBeenCalledTimes(1);
            expect((error as MiotError).stampRefreshed).toBe(false);
        });

        it('classifies a non-MiotError first-attempt failure as an unretried transport error', async () => {
            mockGetProperty.mockRejectedValue(new Error('Still failing'));

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });

            const error = await device.getProperty(2, 1).catch((err: unknown) => err);

            expect((error as MiotError).kind).toBe(MIOT_ERROR_TRANSPORT_ERROR);
            expect((error as MiotError).stampRefreshed).toBe(false);
        });

        it('classifies a non-MiotError from the retry as a transport error', async () => {
            mockGetProperty.mockRejectedValue(new Error('Still failing'));

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            const error = await device.getProperty(2, 1).catch((err: unknown) => err);

            expect((error as MiotError).kind).toBe(MIOT_ERROR_TRANSPORT_ERROR);
            expect((error as MiotError).stampRefreshed).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // setProperty
    // -----------------------------------------------------------------------

    describe('setProperty()', () => {
        it('resolves without error on success', async () => {
            mockSetProperty.mockResolvedValue(undefined);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            await expect(device.setProperty(2, 1, 'on')).resolves.toBeUndefined();
        });

        it('forwards args to transport', async () => {
            mockSetProperty.mockResolvedValue(undefined);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            await device.setProperty(3, 7, 100);
            expect(mockSetProperty).toHaveBeenCalledWith(DEVICE_ID, expect.any(DeviceClock), 3, 7, 100);
        });
    });

    // -----------------------------------------------------------------------
    // callAction
    // -----------------------------------------------------------------------

    describe('callAction()', () => {
        // An action the device acknowledges and then ignores looks like any other success; only
        // its answer can tell, so the answer is handed to the caller.
        it('resolves with the device\'s answer', async () => {
            mockCallAction.mockResolvedValue(ACTION_OK);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            await expect(device.callAction(2, 1)).resolves.toEqual(ACTION_OK);
        });

        it('forwards aiid and optional args', async () => {
            mockCallAction.mockResolvedValue(ACTION_OK);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            await device.callAction(5, 3, 'start');
            expect(mockCallAction).toHaveBeenCalledWith(DEVICE_ID, expect.any(DeviceClock), 5, 3, 'start');
        });
    });

    // -----------------------------------------------------------------------
    // getProperties
    // -----------------------------------------------------------------------

    describe('getProperties()', () => {
        it('returns results array', async () => {
            const results: GetPropertiesResult[] = [
                { siid: 2, piid: 1, value: 10, code: 0 },
                { siid: 2, piid: 2, value: 20, code: 0 }
            ];
            mockGetProperties.mockResolvedValue(results);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: Date.now() });

            const out = await device.getProperties([{ siid: 2, piid: 1 }, { siid: 2, piid: 2 }]);
            expect(out).toHaveLength(2);
            expect(out[0].value).toBe(10);
        });

        // Packets sent do not move the reading; only the device reporting its clock does.
        it('leaves the clock reading as the device reported it', async () => {
            mockGetProperties.mockResolvedValue([]);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID });
            device.setStampState({ stamp: STAMP, updatedAt: 12345 });

            await device.getProperties([{ siid: 2, piid: 1 }, { siid: 2, piid: 2 }]);

            expect(device.getStampState()).toEqual({ stamp: STAMP, updatedAt: 12345 });
        });
    });

    // -----------------------------------------------------------------------
    // stamp state management
    // -----------------------------------------------------------------------

    describe('stamp state', () => {
        it('getStampState returns undefined before connect', () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            expect(device.getStampState()).toBeUndefined();
        });

        it('setStampState seeds the internal state', () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            const state: StampState = { stamp: 999, updatedAt: 12345 };
            device.setStampState(state);
            expect(device.getStampState()).toEqual(state);
        });

    });

    // -----------------------------------------------------------------------
    // IStampStore integration
    // -----------------------------------------------------------------------

    describe('IStampStore', () => {
        it('loads stamp from store when no local state exists', async () => {
            const storedState: StampState = { stamp: 200, updatedAt: Date.now() };
            const store: IStampStore = {
                getStamp: vi.fn<() => Promise<StampState | null>>().mockResolvedValue(storedState),
                setStamp: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
            };
            const stamps = recordStamps();

            const device = new MiotDevice({
                address: '1.2.3.4',
                token: TOKEN,
                deviceId: DEVICE_ID,
                stampStore: store
            });

            await device.getProperty(2, 1);

            expect(store.getStamp).toHaveBeenCalledOnce();
            expect(stamps).toEqual([storedState.stamp + 1]);
            expect(mockHandshake).not.toHaveBeenCalled();
        });

        it('handshakes first when the stored reading has no time', async () => {
            const store: IStampStore = {
                getStamp: vi.fn<() => Promise<StampState | null>>().mockResolvedValue({ stamp: 200, updatedAt: 0 }),
                setStamp: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
            };
            const stamps = recordStamps();

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID, stampStore: store });
            await device.getProperty(2, 1);

            expect(mockHandshake).toHaveBeenCalledOnce();
            expect(stamps).toEqual([STAMP + 1]);
        });

        it('falls through to fresh stamp when store returns null', async () => {
            const store: IStampStore = {
                getStamp: vi.fn<() => Promise<StampState | null>>().mockResolvedValue(null),
                setStamp: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
            };
            mockGetProperty.mockResolvedValue(7);

            const device = new MiotDevice({
                address: '1.2.3.4',
                token: TOKEN,
                deviceId: DEVICE_ID,
                stampStore: store
            });
            // No local stampState AND store returns null → should do fresh handshake
            await device.getProperty(2, 1);

            expect(mockHandshake).toHaveBeenCalledOnce();
        });

        it('updates store after successful stamp refresh', async () => {
            const store: IStampStore = {
                getStamp: vi.fn<() => Promise<StampState | null>>().mockResolvedValue(null),
                setStamp: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
            };
            mockGetProperty.mockResolvedValue(5);

            // no local stamp, store returns null → fresh handshake → store.setStamp called
            const device = new MiotDevice({
                address: '1.2.3.4',
                token: TOKEN,
                deviceId: DEVICE_ID,
                stampStore: store
            });

            await device.getProperty(2, 1);

            expect(store.setStamp).toHaveBeenCalled();
        });

        it('does not re-send a successful action when the stamp store write fails (cached stamp)', async () => {
            const store: IStampStore = {
                getStamp: vi.fn<() => Promise<StampState | null>>().mockResolvedValue({ stamp: STAMP, updatedAt: Date.now() }),
                setStamp: vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('redis down'))
            };
            mockCallAction.mockResolvedValue(ACTION_OK);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID, stampStore: store });
            await device.callAction(2, 1);

            expect(mockCallAction).toHaveBeenCalledTimes(1);
            expect(mockHandshake).not.toHaveBeenCalled();
        });

        it('does not re-send a successful action when the stamp store write fails (fresh stamp)', async () => {
            const store: IStampStore = {
                getStamp: vi.fn<() => Promise<StampState | null>>().mockResolvedValue(null),
                setStamp: vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('redis down'))
            };
            mockCallAction.mockResolvedValue(ACTION_OK);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID, stampStore: store });
            await device.callAction(2, 1);

            expect(mockCallAction).toHaveBeenCalledTimes(1);
            expect(mockHandshake).toHaveBeenCalledTimes(1);
        });

        it('tolerates a stamp store rejecting with a non-Error value', async () => {
            const store: IStampStore = {
                getStamp: vi.fn<() => Promise<StampState | null>>().mockResolvedValue({ stamp: STAMP, updatedAt: Date.now() }),
                setStamp: vi.fn<() => Promise<void>>().mockRejectedValueOnce('redis down')
            };
            mockCallAction.mockResolvedValue(ACTION_OK);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: DEVICE_ID, stampStore: store });
            await device.callAction(2, 1);

            expect(mockCallAction).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // deviceId accessor
    // -----------------------------------------------------------------------

    describe('deviceId accessor', () => {
        it('returns undefined before connect', () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            expect(device.deviceId).toBeUndefined();
        });

        it('returns pre-configured deviceId from options', () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN, deviceId: 999 });
            expect(device.deviceId).toBe(999);
        });

        it('returns deviceId after connect', async () => {
            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await device.connect();
            expect(device.deviceId).toBe(DEVICE_ID);
        });
    });

    describe('default logger', () => {
        it('is a no-op when options.logger is omitted', async () => {
            const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

            const device = new MiotDevice({ address: '1.2.3.4', token: TOKEN });
            await device.discover();

            expect(debug).not.toHaveBeenCalled();
        });
    });
});
