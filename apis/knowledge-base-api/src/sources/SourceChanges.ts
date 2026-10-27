import type { SourceDocument } from './SourceDocument.js';

/** What a source reports for one run. */
export interface SourceChanges {
    readonly upserts: readonly SourceDocument[];
    /** External ids that are gone. Ignored when `complete` is true. */
    readonly deletes: readonly string[];
    /** Where the next run starts. Stored only after every change above is written. */
    readonly cursor: string;
    /**
     * `upserts` is everything the source holds — a first run, or a source that could not say
     * what changed. Whatever else is stored for the KB is deleted.
     */
    readonly complete: boolean;
}
