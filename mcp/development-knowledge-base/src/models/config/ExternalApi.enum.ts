/**
 * External APIs this server calls through `@radoslavirha/http-provider`. Each value must have a
 * matching entry under `externalApis` in the configuration.
 */
export enum ExternalApi {
    /**
     * knowledge-base-api, called as this server's own client (`development-kb-mcp`,
     * `client_credentials`) — never with the token an MCP client presented.
     */
    KnowledgeBaseApi = 'KNOWLEDGE_BASE_API'
}
