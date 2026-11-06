import type { SourceChanges } from './SourceChanges.js';
import type { SourceFile, SourceWriter } from './SourceWriter.js';

/**
 * A source reports what changed since a cursor. `null` asks for everything. Adding a source
 * (Paperless, a folder) is one implementation of this and a config entry.
 *
 * Writing is optional: a source that can be written has a {@link writer}; for any other, the
 * write routes answer `501`.
 *
 * Reading one named file is optional too: {@link file} serves a knowledge base's
 * `conventionsPath`, which need not be indexed. Without it, `GET /conventions` answers `501` for a
 * knowledge base that names one.
 */
export interface SourceAdapter {
    readonly writer?: SourceWriter;

    /** One file as the source holds it now — any path, indexed or not — or `null` when there is none. */
    file?(path: string): Promise<SourceFile | null>;

    /** `signal` cancels the read: the adapter stops between files and aborts the call in flight. */
    changes(cursor: string | null, signal?: AbortSignal): Promise<SourceChanges>;
}
