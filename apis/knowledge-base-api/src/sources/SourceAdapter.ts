import type { SourceChanges } from './SourceChanges.js';
import type { SourceWriter } from './SourceWriter.js';

/**
 * A source reports what changed since a cursor. `null` asks for everything. Adding a source
 * (Paperless, a folder) is one implementation of this and a config entry.
 *
 * Writing is optional: a source that can be written has a {@link writer}; for any other, the
 * write routes answer `501`.
 */
export interface SourceAdapter {
    readonly writer?: SourceWriter;

    /** `signal` cancels the read: the adapter stops between files and aborts the call in flight. */
    changes(cursor: string | null, signal?: AbortSignal): Promise<SourceChanges>;
}
