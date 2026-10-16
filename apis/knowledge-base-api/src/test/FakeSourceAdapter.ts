import { CommonUtils } from '@radoslavirha/utils';
import type { SourceAdapter } from '../sources/SourceAdapter.js';
import type { SourceChanges } from '../sources/SourceChanges.js';

/** A source whose next answer the test sets, recording the cursors it was asked with. */
export class FakeSourceAdapter implements SourceAdapter {
    public readonly cursors: (string | null)[] = [];
    public next: SourceChanges = { upserts: [], deletes: [], cursor: 'c0', complete: false };
    public failure: Error | undefined;

    public changes(cursor: string | null): Promise<SourceChanges> {
        this.cursors.push(cursor);

        return CommonUtils.isUndefined(this.failure) ? Promise.resolve(this.next) : Promise.reject(this.failure);
    }
}
