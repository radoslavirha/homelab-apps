/**
 * How a markdown document is cut. A source sets it per document when it knows the shape.
 */
export enum ChunkingMode {
    /** One chunk per H2/H3 section; long sections split at paragraph boundaries. */
    Sections = 'SECTIONS',
    /**
     * One chunk per H2 entry, never split — a log whose entries are the unit, such as a docs
     * history with one H2 per commit.
     */
    Entries = 'ENTRIES'
}
