/**
 * How the full-text leg turns a question into a `tsquery`.
 */
export enum FullTextMatch {
    /**
     * Any of the question's lexemes (stop words dropped, stemmed), ranked by `ts_rank_cd`. A
     * question in natural language rarely has every one of its words in one section, so `ALL`
     * matched almost nothing in the step-1 measurement.
     */
    Any = 'ANY',
    /** `websearch_to_tsquery`: every term, plus `"phrases"`, `or` and `-exclusions`. */
    All = 'ALL'
}
