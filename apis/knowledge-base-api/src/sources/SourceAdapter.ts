import type { SourceChanges } from './SourceChanges.js';

/**
 * A source does one thing: report what changed since a cursor. `null` asks for everything.
 * Adding a source (Paperless, a folder) is one implementation of this and a config entry.
 */
export interface SourceAdapter {
    changes(cursor: string | null): Promise<SourceChanges>;
}
