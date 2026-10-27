import { CommonUtils } from '@radoslavirha/utils';
import type { SourceAdapter } from '../sources/SourceAdapter.js';
import type { SourceChanges } from '../sources/SourceChanges.js';

/**
 * A source whose next answer the test sets, recording the cursors it was asked with. With
 * `hanging`, a read never answers until its signal aborts — a long first build, stopped.
 */
export class FakeSourceAdapter implements SourceAdapter {
    public readonly cursors: (string | null)[] = [];
    public next: SourceChanges = { upserts: [], deletes: [], cursor: 'c0', complete: false };
    public failure: Error | undefined;
    public hanging = false;
    /** Reads in progress: a test waits for one before stopping it. */
    public reading = 0;

    public changes(cursor: string | null, signal?: AbortSignal): Promise<SourceChanges> {
        this.cursors.push(cursor);

        if (this.hanging) {
            this.reading++;

            return new Promise((_resolve, reject) => {
                const stop = (): void => {
                    this.reading--;
                    reject(signal?.reason);
                };

                if (signal?.aborted) {
                    stop();
                }
                signal?.addEventListener('abort', stop, { once: true });
            });
        }

        return CommonUtils.isUndefined(this.failure) ? Promise.resolve(this.next) : Promise.reject(this.failure);
    }
}
