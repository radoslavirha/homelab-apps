/** How an indexing run of one knowledge base ended. Stored in `knowledge_bases.last_run_outcome`. */
export enum RunOutcome {
    Success = 'SUCCESS',
    Failure = 'FAILURE',
    /**
     * Stopped part-way: the pod shut down, or the connection holding the index lock was lost.
     * Nothing is wrong with the knowledge base; the next run carries on where this one stopped.
     */
    Interrupted = 'INTERRUPTED'
}
