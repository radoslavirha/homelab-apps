import { CommonUtils } from '@radoslavirha/utils';
import type { StampState } from './types.js';

/** One stamp the device reported, and when it arrived. */
interface ClockReading {
    /** The device's clock, in seconds since its boot. */
    stamp: number;
    /** `performance.now()` when the reading arrived. Monotonic, so elapsed time ignores NTP steps. */
    at: number;
    /** Unix timestamp (ms) of the same moment, for {@link StampState}. */
    updatedAt: number;
}

const MS_PER_SECOND = 1_000;

/**
 * The device's miIO clock, as far as this process can tell.
 *
 * **The header `Stamp` is a clock, not a counter.** It is the device's uptime in seconds. Measured
 * on 2026-10-20 against a xiaomi.vacuum.c102gl: hello probes 17 s apart read 35501 and 35518, +1
 * per wall-clock second, while the poller kept sending packets in between. A packet whose stamp is
 * behind that clock is dropped without an answer, which costs the caller the whole 10 s timeout
 * before `MiotDevice` re-handshakes. Treating the stamp as "+1 per call" fell behind within minutes
 * of polling and on every pod restart.
 *
 * So the stamp to send is derived from time, as python-miio does: the last stamp the device
 * reported, plus the whole seconds elapsed locally since it arrived, plus one. The device's clock
 * at that moment is the elapsed floor or one more (it ticks at its own phase), so the `+ 1` keeps
 * the packet from ever being behind it.
 *
 * Several packets inside one second carry the same stamp. The device answers them: the poller reads
 * one property per packet and no rejection was ever recorded for that.
 */
export class DeviceClock {
    private reading: ClockReading | undefined;

    /** Whether there is a reading to derive a stamp from. Without one, a handshake comes first. */
    public get synced(): boolean {
        return CommonUtils.notUndefined(this.reading);
    }

    /** Records a stamp the device reported in a hello response. */
    public sync(stamp: number): void {
        this.reading = { stamp, at: performance.now(), updatedAt: Date.now() };
    }

    /**
     * Records the stamp in a command response header, when it shows the device ahead of us.
     *
     * Only a stamp **ahead** of what this clock would send now is taken: that is the one case where
     * the estimate is wrong in the harmful direction (local time running slow against the device's).
     * A stamp equal to what we sent cannot be told apart from the device echoing it back, and
     * re-basing on an echo would push the estimate one second further ahead on every call.
     */
    public observe(stamp: number): void {
        if (this.synced && stamp > this.next()) {
            this.sync(stamp);
        }
    }

    /**
     * Restores a persisted reading, aged by the wall-clock time since it was taken.
     *
     * A reading with no time (`updatedAt` 0) cannot be aged and is ignored, so the next command
     * handshakes first. A device that rebooted since is not detected here; its first command fails,
     * and `MiotDevice` re-handshakes.
     */
    public restore(state: StampState): void {
        if (state.updatedAt <= 0) {
            return;
        }
        const age = Math.max(0, Date.now() - state.updatedAt);
        this.reading = { stamp: state.stamp, at: performance.now() - age, updatedAt: state.updatedAt };
    }

    /** Forgets the reading, so the next command handshakes first. */
    public reset(): void {
        this.reading = undefined;
    }

    /** The stamp to put on a packet sent now. */
    public next(): number {
        if (CommonUtils.isUndefined(this.reading)) {
            throw new Error('Device clock is not synced. Handshake first.');
        }
        const elapsed = Math.max(0, performance.now() - this.reading.at);
        return this.reading.stamp + Math.floor(elapsed / MS_PER_SECOND) + 1;
    }

    /** The last reading, for persisting it. `undefined` before the first handshake. */
    public snapshot(): StampState | undefined {
        if (CommonUtils.isUndefined(this.reading)) {
            return undefined;
        }
        return { stamp: this.reading.stamp, updatedAt: this.reading.updatedAt };
    }
}
