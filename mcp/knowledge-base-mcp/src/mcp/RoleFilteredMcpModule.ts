import { CommonUtils } from '@radoslavirha/utils';
import { inject, OverrideProvider } from '@tsed/di';
import type { PlatformContext } from '@tsed/platform-http';
import { PlatformMcpModule, type CreateMcpServerOpts, type ResolvedTool } from '@tsed/platform-mcp';
import { requiredRoleOf } from '../auth/RequireRole.js';
import { McpEndpointService } from '../services/McpEndpointService.js';

/**
 * platform-mcp's module, with each request's MCP server given only the tools the caller may call,
 * so `tools/list` never offers a reader a writing tool.
 *
 * platform-mcp builds a new MCP server per request (stateless Streamable HTTP) from one tool list
 * resolved at boot, and has no hook to narrow it by caller. Its `dispatch` authenticates the
 * request, parks the caller on `req.auth`, and only then reads `settings.tools` to build the
 * server; this override hands it a `tools` that is filtered at that read, against the caller just
 * authenticated. Each tool's level is its own `@RequireRole` (`requiredRoleOf`), checked by
 * `McpEndpointService.holdsRole` — the rule `RoleInterceptor` applies at `tools/call`, which stays
 * as the check for a caller that calls a tool it was not shown.
 *
 * Fails closed: a tool without a level, or a read of `tools` before any caller is on the request,
 * leaves the tool out.
 */
@OverrideProvider(PlatformMcpModule)
export class RoleFilteredMcpModule extends PlatformMcpModule {
    private readonly endpoint = inject(McpEndpointService);

    protected override dispatch(settings: CreateMcpServerOpts, $ctx: PlatformContext): ReturnType<PlatformMcpModule['dispatch']> {
        const allowed = (tool: ResolvedTool): boolean => {
            const level = requiredRoleOf(tool);

            return CommonUtils.notNil(level) && this.endpoint.holdsRole(level);
        };

        return super.dispatch({
            ...settings,
            get tools(): ResolvedTool[] {
                return settings.tools.filter(allowed);
            }
        }, $ctx);
    }
}
