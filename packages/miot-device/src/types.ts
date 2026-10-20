/**
 * OTEL-compliant logger interface.
 * Compatible with child loggers from `@radoslavirha/tsed-logger`.
 */
export interface ILogger {
    trace(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    fatal(message: string, ...args: unknown[]): void;
}

/**
 * The last reading of a device's clock, as persisted.
 *
 * The miIO stamp is the device's uptime in seconds, not a counter (see `DeviceClock`), so a
 * reading is only usable together with the time it was taken.
 */
export interface StampState {
    /** Stamp the device last reported: its clock, in seconds since boot. */
    stamp: number;
    /** Unix timestamp (ms) of when the device reported it. 0 means unknown: the reading is not used. */
    updatedAt: number;
}

/**
 * Optional external stamp store for multi-node deployments (e.g. Redis).
 * If provided, the last clock reading is read on first use and written after
 * every successful operation.
 */
export interface IStampStore {
    getStamp(): Promise<StampState | null>;
    setStamp(state: StampState): Promise<void>;
}

export interface MiotDeviceOptions {
    /** IP address of the device. */
    address: string;
    /** 32-char hex device token. */
    token: string;
    /**
     * Xiaomi hardware device ID.
     * Optional — populated automatically after the first {@link MiotDevice.connect} or
     * {@link MiotDevice.discover} call. Required before command methods can be used.
     */
    deviceId?: number;
    /**
     * Optional external stamp store for multi-node deployments.
     * When provided, the store is consulted on every command and updated after
     * every successful stamp refresh.
     */
    stampStore?: IStampStore;
    /**
     * UDP port the device listens on.
     * @default 54321
     */
    port?: number;
    /**
     * Optional logger. Defaults to a no-op logger.
     */
    logger?: ILogger;
}

/** Result returned by {@link MiotDevice.discover}. */
export interface DiscoverResult {
    deviceId: number;
    stamp: number;
}

/** What a device answered to an `action` it did not refuse. */
export interface ActionResult {
    /**
     * The `code` of the result object. `undefined` when the firmware answered something without
     * one, e.g. the string `'ok'`.
     */
    code: number | undefined;
    /** The response's `result` member, as the device sent it. */
    result: unknown;
}

export interface GetPropertiesResult {
    siid: number;
    piid: number;
    value?: string | number;
    code: number;
}
