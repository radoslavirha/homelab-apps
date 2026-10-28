/** What a `raw/` note holds. */
export enum NoteType {
    /** A choice, the alternatives rejected, and why. */
    Decision = 'DECISION',
    /** How repositories and systems talk to each other: topics, endpoints, URLs, auth. */
    Contract = 'CONTRACT',
    /** Something that cost time once and will again. */
    Gotcha = 'GOTCHA',
    /** Worth keeping, fits none of the above. */
    Note = 'NOTE'
}
