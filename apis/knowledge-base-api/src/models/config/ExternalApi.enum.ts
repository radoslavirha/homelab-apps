/**
 * External APIs this service calls through `@radoslavirha/http-provider`. Each value must have a
 * matching entry under `externalApis` in the configuration.
 *
 * GitHub is not here: it is called through Octokit, which owns the GitHub App token exchange
 * (see `github` in the configuration).
 */
export enum ExternalApi {
    /** Ollama — the embed API that turns chunks and questions into vectors. */
    Ollama = 'OLLAMA'
}
