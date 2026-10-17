/** What `POST /reindex` did with the request. */
export enum ReindexState {
    /** This pod took the index lock; the run is in progress. */
    Started = 'STARTED',
    /** A run is in progress in this pod; this one follows it, merged with any other queued request. */
    Queued = 'QUEUED'
}
