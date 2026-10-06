import type { ILogger } from './types.js';

export const NOOP_LOGGER: ILogger = {
    trace: () => undefined,
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined
};
