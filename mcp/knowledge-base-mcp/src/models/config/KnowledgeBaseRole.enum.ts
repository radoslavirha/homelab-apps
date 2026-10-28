/**
 * The levels a tool may require, the same for every endpoint. Each endpoint maps them to its own
 * Authentik roles in `mcpServers.<key>.auth.roles` (`READER` → `knowledge-base-mcp-development.reader`), since
 * the tools are shared and cannot name one endpoint's roles.
 */
export enum KnowledgeBaseRole {
    /** Search and read. */
    Reader = 'READER',
    /** Create, rewrite and delete documents. Authentik gives an editor the reader role too. */
    Editor = 'EDITOR'
}
