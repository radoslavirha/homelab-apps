/**
 * Where a knowledge base's documents come from. Each value has one `SourceAdapter`
 * implementation; adding a source (Paperless, a folder) is a new value, a new adapter and a
 * config entry — the pipeline after the adapter is shared.
 *
 * Stored as-is in `knowledge_bases.source`.
 */
export enum KnowledgeBaseSource {
    /** A git repository read through the GitHub API as a GitHub App. */
    Git = 'GIT'
}
