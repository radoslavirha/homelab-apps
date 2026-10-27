/** A document as the source holds it now. */
export interface SourceFile {
    readonly content: string;
    /** The revision the source's write checks — the same meaning as `SourceDocument.version`. */
    readonly version: string;
}

/** What one delete left in the source. */
export interface SourceDeleteResult {
    /** The commit (or the source's equivalent) the write made. */
    readonly commit: string;
}

/** What one create or rewrite left in the source. */
export interface SourceWriteResult extends SourceDeleteResult {
    /** The document's new version: what the next write of it passes. */
    readonly version: string;
}

/**
 * The write capability of a source: one document, and one commit, per call.
 *
 * A write is checked by the source, not here: `version` is what the caller last saw, and the
 * source refuses — {@link SourceWriteRefusedError} — when it no longer holds that version, or
 * when a create finds the document already there. Why it refused is for the caller to find out
 * with {@link read}; a refusal says nothing more.
 */
export interface SourceWriter {
    /** The document now, or `null` when the source holds none at `id`. */
    read(id: string): Promise<SourceFile | null>;
    /** Creates `id` when `version` is `null`; otherwise replaces the document at that version. */
    write(id: string, content: string, version: string | null, message: string): Promise<SourceWriteResult>;
    /** Deletes the document at that version. */
    delete(id: string, version: string, message: string): Promise<SourceDeleteResult>;
}
