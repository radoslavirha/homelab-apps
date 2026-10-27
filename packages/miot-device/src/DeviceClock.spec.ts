import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceClock } from './DeviceClock.js';

const NOW = 1_000_000;
const WALL_NOW = 1_760_000_000_000;
// Measured on the production vacuum: hello probes read 35501, then 35518 seventeen seconds later.
const HANDSHAKE_STAMP = 35501;

describe('DeviceClock', () => {
    let elapsed: number;

    beforeEach(() => {
        elapsed = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => NOW + elapsed);
        vi.spyOn(Date, 'now').mockReturnValue(WALL_NOW);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const advance = (ms: number): void => {
        elapsed += ms;
    };

    describe('next()', () => {
        it('refuses to make up a stamp before a handshake', () => {
            const clock = new DeviceClock();

            expect(clock.synced).toBe(false);
            expect(() => clock.next()).toThrow('Device clock is not synced');
        });

        it('sends one ahead of the handshake stamp right after it', () => {
            const clock = new DeviceClock();
            clock.sync(HANDSHAKE_STAMP);

            expect(clock.synced).toBe(true);
            expect(clock.next()).toBe(HANDSHAKE_STAMP + 1);
        });

        // The regression. The stamp is the device's uptime in seconds, so after 17 s the device
        // reads 35518 however many packets were sent meanwhile. A per-call counter would still be
        // at 35502 and the device would drop the packet.
        it('advances with elapsed time, as the device clock does, not with the number of calls', () => {
            const clock = new DeviceClock();
            clock.sync(HANDSHAKE_STAMP);
            clock.next();
            clock.next();

            advance(17_000);

            expect(clock.next()).toBe(35518 + 1);
        });

        it('counts only whole seconds, since the device ticks at its own phase', () => {
            const clock = new DeviceClock();
            clock.sync(HANDSHAKE_STAMP);

            advance(999);
            expect(clock.next()).toBe(HANDSHAKE_STAMP + 1);

            advance(1);
            expect(clock.next()).toBe(HANDSHAKE_STAMP + 2);
        });
    });

    describe('observe()', () => {
        it('re-bases on a response stamp ahead of the estimate', () => {
            const clock = new DeviceClock();
            clock.sync(HANDSHAKE_STAMP);

            clock.observe(HANDSHAKE_STAMP + 10);

            expect(clock.next()).toBe(HANDSHAKE_STAMP + 11);
        });

        it('keeps the estimate on a response stamp equal to it, which may be an echo', () => {
            const clock = new DeviceClock();
            clock.sync(HANDSHAKE_STAMP);

            clock.observe(HANDSHAKE_STAMP + 1);
            clock.observe(HANDSHAKE_STAMP);

            expect(clock.next()).toBe(HANDSHAKE_STAMP + 1);
        });

        it('takes nothing from a response before a handshake', () => {
            const clock = new DeviceClock();

            clock.observe(HANDSHAKE_STAMP);

            expect(clock.synced).toBe(false);
        });
    });

    describe('restore()', () => {
        it('ages a persisted reading by the wall-clock time since it was taken', () => {
            const clock = new DeviceClock();

            clock.restore({ stamp: HANDSHAKE_STAMP, updatedAt: WALL_NOW - 17_000 });

            expect(clock.next()).toBe(HANDSHAKE_STAMP + 18);
        });

        it('treats a reading from the future as taken now', () => {
            const clock = new DeviceClock();

            clock.restore({ stamp: HANDSHAKE_STAMP, updatedAt: WALL_NOW + 60_000 });

            expect(clock.next()).toBe(HANDSHAKE_STAMP + 1);
        });

        it('ignores a reading with no time, so the next command handshakes', () => {
            const clock = new DeviceClock();

            clock.restore({ stamp: HANDSHAKE_STAMP, updatedAt: 0 });

            expect(clock.synced).toBe(false);
        });
    });

    describe('snapshot() and reset()', () => {
        it('has nothing to persist before a handshake', () => {
            expect(new DeviceClock().snapshot()).toBeUndefined();
        });

        it('persists the reading as the device reported it, with its wall-clock time', () => {
            const clock = new DeviceClock();
            clock.sync(HANDSHAKE_STAMP);
            advance(5_000);

            expect(clock.snapshot()).toEqual({ stamp: HANDSHAKE_STAMP, updatedAt: WALL_NOW });
        });

        it('round-trips a restored reading unchanged', () => {
            const clock = new DeviceClock();

            clock.restore({ stamp: HANDSHAKE_STAMP, updatedAt: 12345 });

            expect(clock.snapshot()).toEqual({ stamp: HANDSHAKE_STAMP, updatedAt: 12345 });
        });

        it('forgets the reading on reset', () => {
            const clock = new DeviceClock();
            clock.sync(HANDSHAKE_STAMP);

            clock.reset();

            expect(clock.synced).toBe(false);
            expect(clock.snapshot()).toBeUndefined();
        });
    });
});
