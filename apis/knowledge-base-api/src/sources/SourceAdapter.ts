import type { SourceChanges } from './SourceChanges.js';

/**
 * A source does one thing: report what changed since a cursor. `null` asks for everything.
 * Adding a source (Paperless, a folder) is one implementation of this and a config entry.
 */
export interface SourceAdapter {
    /** `signal` cancels the read: the adapter stops between files and aborts the call in flight. */
    changes(cursor: string | null, signal?: AbortSignal): Promise<SourceChanges>;
}
