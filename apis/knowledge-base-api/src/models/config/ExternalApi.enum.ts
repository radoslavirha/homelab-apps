/**
 * External APIs this service calls through `@radoslavirha/http-provider`. Each value must have a
 * matching entry under `externalApis` in the configuration.
 *
 * GitHub is not here: it is called through Octokit, which owns the GitHub App token exchange
 * (see `github` in the configuration).
 */
export enum ExternalApi {
    /** Ollama's embed API for indexing: batches of chunks, a budget long enough for a CPU. */
    Ollama = 'OLLAMA',
    /**
     * The same Ollama, for embedding a question at search time. A short budget and no retry:
     * answering from full-text at once beats waiting out the indexing budget on a slow embedder.
     */
    OllamaSearch = 'OLLAMA_SEARCH'
}
