import { CommonUtils } from '@radoslavirha/utils';
import { DeviceClock } from './DeviceClock.js';
import { MiotTransport } from './MiotTransport.js';
import {
    MiotError,
    MIOT_ERROR_TRANSPORT_ERROR,
    MIOT_METHOD_ACTION,
    MIOT_METHOD_GET_PROPERTIES,
    MIOT_METHOD_SET_PROPERTIES,
    type MiotMethod
} from './MiotError.js';
import { NOOP_LOGGER } from './noopLogger.js';
import type { ActionResult, DiscoverResult, GetPropertiesResult, ILogger, MiotDeviceOptions, StampState } from './types.js';

/**
 * Stateful MIoT device client.
 *
 * Each instance represents a single physical device. The instance owns the
 * stamp lifecycle: it tracks the device's clock (see {@link DeviceClock}) from
 * the handshake and the response headers, derives each packet's stamp from it,
 * and reactively re-handshakes on command failure.
 *
 * ### Typical single-node usage
 * ```ts
 * const device = new MiotDevice({ address: '192.168.1.42', token: 'aabbcc...' });
 * const { deviceId } = await device.connect();
 * const fan = await device.getProperty(2, 11);
 * ```
 *
 * ### Multi-node usage (stamp backed by Redis / DB)
 * Supply an {@link IStampStore} implementation via `options.stampStore`.
 * The store is consulted when this instance has no clock reading, and updated
 * after every successful command.
 */
export class MiotDevice {
    private readonly transport: MiotTransport;
    private readonly options: MiotDeviceOptions;
    private readonly logger: ILogger;
    private _deviceId: number | undefined;
    private readonly clock = new DeviceClock();
    /** Tail of the command queue; see `runWithStamp`. */
    private _queue: Promise<void> = Promise.resolve();

    constructor(options: MiotDeviceOptions) {
        this.options = options;
        this._deviceId = options.deviceId;
        this.logger = options.logger ?? NOOP_LOGGER;
        this.transport = new MiotTransport(options.address, options.token, options.port, this.logger);
    }

    /**
     * Sends a hello packet to the device and returns its current identity.
     * Also seeds the internal stamp state so subsequent commands avoid a
     * redundant handshake.
     *
     * Intended for **device discovery** (registering a new device) and
     * **connectivity checks**. After calling `discover()` the instance is
     * ready to send commands — no separate `connect()` call is needed.
     */
    async discover(): Promise<DiscoverResult> {
        this.logger.debug(`Discovering device`, { address: this.options.address });
        const result = await this.transport.handshake();
        this._deviceId = result.deviceId;
        this.clock.sync(result.stamp);
        await this.persistStamp();
        this.logger.debug(`Device discovered`, { deviceId: result.deviceId, stamp: result.stamp });
        return result;
    }

    /**
     * Establishes the connection to the device: performs a handshake and
     * seeds the internal stamp state. Must be called before using any
     * command methods when `deviceId` was not set in the constructor.
     *
     * Throws if the device is unreachable.
     */
    async connect(): Promise<void> {
        await this.discover();
    }

    async getProperty(siid: number, piid: number): Promise<string | number | undefined> {
        return this.runWithStamp(MIOT_METHOD_GET_PROPERTIES, (deviceId) => this.transport.getProperty(deviceId, this.clock, siid, piid));
    }

    async setProperty(siid: number, piid: number, value: string | number): Promise<void> {
        await this.runWithStamp(MIOT_METHOD_SET_PROPERTIES, (deviceId) => this.transport.setProperty(deviceId, this.clock, siid, piid, value));
    }

    /**
     * Executes an action. Resolves with the device's answer: a device that acknowledges an action
     * and then ignores it is only visible in that answer, so it is the caller's to record.
     */
    async callAction(siid: number, aiid: number, args?: unknown): Promise<ActionResult> {
        return this.runWithStamp(MIOT_METHOD_ACTION, (deviceId) => this.transport.callAction(deviceId, this.clock, siid, aiid, args));
    }

    /**
     * Reads multiple properties, one UDP call per property, under a single stamp-refresh retry.
     *
     * Kept as a set-shaped call rather than folded into {@link getProperty} because the caller
     * wants the per-property `code`: `getProperty` raises on a non-zero one, which is the wrong
     * shape for a poller that must tolerate one refused entry and still report the rest. See
     * `MiotTransport.getProperties` for why the multi-property packet is not used.
     *
     * @param props - Properties to read, identified by siid + piid.
     */
    async getProperties(props: Array<{ siid: number; piid: number }>): Promise<GetPropertiesResult[]> {
        return this.runWithStamp(MIOT_METHOD_GET_PROPERTIES, (deviceId) => this.transport.getProperties(deviceId, this.clock, props));
    }

    /**
     * Returns the last reading of the device's clock.
     * Useful for manually persisting it on shutdown or seeding another instance.
     * Returns `undefined` until a handshake has happened.
     */
    getStampState(): StampState | undefined {
        return this.clock.snapshot();
    }

    /**
     * Seeds the device clock without performing a handshake. The reading is aged by the wall-clock
     * time since `state.updatedAt`; one with `updatedAt` 0 is ignored.
     *
     * Only for a reading taken shortly before, e.g. handed over from another node. A reading kept
     * across a restart is not worth restoring: the device may have rebooted and reset its clock,
     * and the first command would then cost a full timeout before the re-handshake. A handshake is
     * one round trip.
     */
    setStampState(state: StampState): void {
        this.clock.restore(state);
    }

    /** The hardware device ID, set after the first `connect()` or `discover()` call. */
    get deviceId(): number | undefined {
        return this._deviceId;
    }

    /**
     * Runs `fn` with automatic stamp-refresh retry.
     *
     * If the device clock has no reading, a fresh handshake is performed first.
     * Otherwise `fn` sends with stamps derived from the cached reading; on
     * failure the reading is dropped, a handshake is performed, and the call is
     * retried once.
     *
     * **The retry is unconditional, and that is worth knowing when reading telemetry.** A stale
     * stamp and a refused property are indistinguishable here, so a `device_error` such as
     * `-4004` — which will never succeed on a second attempt — still costs a handshake plus a
     * second round trip before it surfaces. The failure that does surface says so via
     * {@link MiotError.stampRefreshed}; the app puts that on the call span.
     *
     * @param method - The miIO method `fn` will call, so a failure keeps naming it after the
     *                 stamp-refresh retry has re-thrown.
     */
    private runWithStamp<T>(
        method: MiotMethod,
        fn: (deviceId: number) => Promise<T>
    ): Promise<T> {
        // Serialize per instance: a failure resets the shared clock and re-handshakes, which a
        // concurrent call would see half-way through. One packet in flight per device also matches
        // what the device itself copes with.
        const run = this._queue.then(() => this.runWithStampExclusive(method, fn));
        this._queue = run.then(() => undefined, () => undefined);
        return run;
    }

    private async runWithStampExclusive<T>(
        method: MiotMethod,
        fn: (deviceId: number) => Promise<T>
    ): Promise<T> {
        const deviceId = this.requireDeviceId();

        // Load the clock reading from external store if available (multi-node support)
        if (this.options.stampStore && !this.clock.synced) {
            const stored = await this.options.stampStore.getStamp();
            if (stored) {
                this.clock.restore(stored);
            }
        }

        if (!this.clock.synced) {
            return this.runWithFreshStamp(method, deviceId, fn, false);
        }

        try {
            this.logger.debug(`Sending command with cached device clock`, { deviceId });
            const result = await fn(deviceId);
            await this.persistStampSafely();
            return result;
        } catch (_err) {
            // Command failed — drop the clock reading and retry with fresh handshake
            this.clock.reset();
            const reason = _err instanceof Error ? _err.message : String(_err);
            this.logger.warn(`Sending command failed`, { deviceId, reason, retryingWithFreshStamp: true });
        }

        return this.runWithFreshStamp(method, deviceId, fn, true);
    }

    private async runWithFreshStamp<T>(
        method: MiotMethod,
        deviceId: number,
        fn: (deviceId: number) => Promise<T>,
        retried: boolean
    ): Promise<T> {
        this.logger.debug(`Performing fresh handshake`, { deviceId });
        const { stamp } = await this.transport.handshake();
        this.clock.sync(stamp);
        try {
            const result = await fn(deviceId);
            await this.persistStampSafely();
            return result;
        } catch (retryError) {
            const reason = retryError instanceof Error ? retryError.message : String(retryError);
            // Re-thrown as a MiotError that keeps `kind` and `code`. The previous
            // `new Error(...)` here flattened a `-4004` refusal into prose, which is exactly the
            // information the app needs to tell "our override is wrong" from "the device is
            // asleep".
            const failure = retried
                ? MiotError.afterStampRefresh(retryError, method, deviceId)
                : MiotError.is(retryError)
                    ? retryError
                    : new MiotError(reason, {
                        kind: MIOT_ERROR_TRANSPORT_ERROR,
                        method,
                        cause: retryError
                    });
            this.logger.error(retried ? `Operation failed after stamp refresh` : `Operation failed`, {
                deviceId,
                method: failure.method,
                kind: failure.kind,
                code: failure.code,
                reason
            });
            throw failure;
        }
    }

    private async persistStampSafely(): Promise<void> {
        // The command already succeeded on the device, so a store failure must not reach the
        // retry logic (it would re-send a non-idempotent command). The in-memory clock is kept.
        try {
            await this.persistStamp();
        } catch (err) {
            this.logger.warn(`Failed to persist stamp`, { reason: err instanceof Error ? err.message : String(err) });
        }
    }

    private async persistStamp(): Promise<void> {
        const state = this.clock.snapshot();
        if (this.options.stampStore && state) {
            await this.options.stampStore.setStamp(state);
        }
    }

    private requireDeviceId(): number {
        if (CommonUtils.isUndefined(this._deviceId)) {
            throw new Error('Device not connected. Call connect() or discover() first.');
        }
        return this._deviceId;
    }
}
