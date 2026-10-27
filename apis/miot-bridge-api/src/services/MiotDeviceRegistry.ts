import { Injectable, Scope, ProviderScope } from '@tsed/di';
import { MiotDevice } from '@radoslavirha/miot-device';
import type { DeviceCache } from '../models/DeviceCache.js';
import { Logger } from '@radoslavirha/tsed-logger';

/**
 * Maintains a pool of {@link MiotDevice} instances, one per registered device.
 * Acts as the bridge between the domain model (`DeviceCache`) and the
 * transport-level `MiotDevice` — the registry never performs storage I/O.
 *
 * Instances are keyed by hardware `deviceId`. On first access the instance is
 * created **without** a stamp: its first command handshakes, and `MiotDevice`
 * tracks the device clock from there.
 */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class MiotDeviceRegistry {
    private readonly _registry = new Map<number, MiotDevice>();

    constructor(private readonly logger: Logger) {}

    /**
     * Returns the existing `MiotDevice` instance for the device, creating and
     * seeding one from `device` if it does not yet exist.
     *
     * No I/O is performed here — the device handshakes lazily on its first command.
     */
    public getOrCreate(device: DeviceCache): MiotDevice {
        const existing = this._registry.get(device.deviceId);
        if (existing) {
            return existing;
        }

        const instance = new MiotDevice({
            address: device.address,
            token: device.token,
            deviceId: device.deviceId,
            logger: this.logger.child('MIOT_DEVICE')
        });

        // Deliberately not seeded. The stamp is the device's clock (seconds since boot), so any
        // stored copy is behind it, or from before the device last rebooted. Seeding from the
        // registration-time copy made the first command after every pod restart wait out a 10 s
        // timeout before re-handshaking. A handshake is one round trip.

        this._registry.set(device.deviceId, instance);
        return instance;
    }

    /**
     * Removes the instance associated with the given hardware device ID.
     * Should be called when a device is deleted from storage.
     */
    public remove(deviceId: number): void {
        this._registry.delete(deviceId);
    }
}
