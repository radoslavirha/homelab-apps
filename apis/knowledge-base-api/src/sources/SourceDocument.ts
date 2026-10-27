import type { ChunkingMode } from '../models/ChunkingMode.enum.js';

/** One document as a source reports it. Everything after the adapter is source-neutral. */
export interface SourceDocument {
    /** Stable id within the KB — git: the path; Paperless: the document id. */
    readonly externalId: string;
    readonly title: string | null;
    /** `YYYY-MM-DD`, when the source has one. */
    readonly date: string | null;
    /** Link back to the original. */
    readonly url: string | null;
    /** The whole document as text. */
    readonly content: string;
    /**
     * Which revision this is, as the source's write checks it — git: the file's blob SHA;
     * Paperless: modified timestamp.
     */
    readonly version: string;
    /** Source-specific, filterable fields. Must be JSON. */
    readonly metadata: Readonly<Record<string, unknown>>;
    /** How to cut it, when the source knows better than the KB default. */
    readonly chunking?: ChunkingMode;
}
