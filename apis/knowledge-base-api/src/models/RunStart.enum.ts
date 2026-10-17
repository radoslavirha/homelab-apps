/** How a triggered indexing run started. Internal: `POST /reindex` turns it into its answer. */
export enum RunStart {
    /** This pod took the index lock; the run is in progress. */
    Started = 'STARTED',
    /** A run is in progress in this pod; the request follows it. */
    Queued = 'QUEUED',
    /** Another pod holds the index lock and is indexing; nothing runs here. */
    Skipped = 'SKIPPED'
}
