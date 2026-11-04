/**
 * MCP servers this app mounts, one endpoint each. Each value must have a matching entry under
 * `mcpServers` in the configuration — the same contract as `ExternalApi` and `externalApis`.
 *
 * A second server (a household knowledge base, say) is a new value here and a new config entry:
 * its own path, `kb`, name, description and `auth`. Tool names are global in platform-mcp, so
 * servers share the tools in `src/tools/`.
 */
export enum McpServer {
    /** The development knowledge base: decisions, specs, contracts and docs of the homelab repositories. */
    DevelopmentKb = 'DEVELOPMENT_KB'
}
