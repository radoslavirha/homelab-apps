/** Which legs answered a search. */
export enum SearchMode {
    /** Full-text and vector, fused by reciprocal rank fusion. */
    Hybrid = 'HYBRID',
    /** Vector only — the full-text leg is weighted 0 (the default, as measured). */
    Vector = 'VECTOR',
    /** Full-text only: no KB searched has a model, or the embedder could not be reached. */
    FullText = 'FULLTEXT'
}
