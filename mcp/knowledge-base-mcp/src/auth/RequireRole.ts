import type { Type } from '@tsed/core';
import { getInterceptorOptions, Intercept } from '@tsed/di';
import type { ResolvedTool } from '@tsed/platform-mcp';
import { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { RoleInterceptor } from './RoleInterceptor.js';

/**
 * The least role a tool needs, as a level each endpoint maps to its own Authentik role. Goes on
 * every tool method — a spec fails for a tool without it. `tools/list` shows a caller only the
 * tools whose level it holds (`RoleFilteredMcpModule`), so through MCP a caller below it finds no
 * such tool; `RoleInterceptor` still refuses the call ("Insufficient permissions.") should the
 * tool ever be reached. Reading tools take `Reader`, writing tools `Editor`.
 */
export const RequireRole = (level: KnowledgeBaseRole): MethodDecorator => Intercept(RoleInterceptor, level);

/**
 * The level a tool's `@RequireRole` declares, read from the same interceptor metadata the
 * per-call check runs on, so a tool's level is written once. `undefined` for a tool that declares
 * none, or that is no class method: such a tool is held by nobody.
 */
export const requiredRoleOf = (tool: ResolvedTool): KnowledgeBaseRole | undefined => {
    if (!('token' in tool)) {
        return undefined;
    }

    // Only reads the method's metadata store, which an abstract class has as well.
    const level = getInterceptorOptions<unknown>(tool.token as Type<unknown>, tool.propertyKey);

    return Object.values<unknown>(KnowledgeBaseRole).includes(level) ? level as KnowledgeBaseRole : undefined;
};
