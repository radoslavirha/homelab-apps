import type { IncomingMessage } from 'node:http';
import type { AuthInfo } from '@modelcontextprotocol/server';
import type { Principal } from '@radoslavirha/auth';
import { CommonUtils, ObjectUtils } from '@radoslavirha/utils';
import { getContext, Injectable, ProviderScope, Scope } from '@tsed/di';
import { Forbidden, InternalServerError } from '@tsed/exceptions';
import type { PlatformContext } from '@tsed/platform-http';
import type { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import type { McpServerConfig } from '../models/config/McpServerConfig.js';
import { ConfigService } from './ConfigService.js';

/** A request URL's path, without the query and without a trailing slash Express would also route. */
const pathOf = (url: string): string => {
    const path = url.split('?')[0];

    return path.length > 1 ? path.replace(/\/+$/, '') : path;
};

/**
 * The MCP endpoint a tool call came in on, and who made it.
 *
 * An endpoint is its knowledge base: `/development` serves `dev` and nothing else, as configured
 * in `mcpServers.<key>.kb`. A caller never names one. platform-mcp registers tool names globally,
 * so every endpoint shares the same tool instances; a tool asks this service, which matches the
 * path of the request being handled against the mounted endpoints.
 */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class McpEndpointService {
    public constructor(private readonly configService: ConfigService) {}

    /** The `kb` of the endpoint handling this request. */
    public knowledgeBase(): string {
        return this.current().endpoint.kb;
    }

    /**
     * Refuses the call unless the caller holds this endpoint's role for `level` — an exact
     * string, no hierarchy, as in the APIs: Authentik gives an editor the reader role too.
     * `McpTokenVerifier` has already turned away a caller holding none of the endpoint's roles;
     * this is the per-tool floor on top. The refusal names no role.
     */
    public requireRole(level: KnowledgeBaseRole): void {
        const { endpoint, ctx } = this.current();
        const principal = (ctx.getReq() as IncomingMessage & { auth?: AuthInfo }).auth?.extra?.principal as Principal | undefined;

        if (CommonUtils.isUndefined(principal) || !principal.roles.includes(endpoint.auth.roles[level])) {
            throw new Forbidden('Insufficient permissions.');
        }
    }

    /**
     * Outside a request, or on a path no endpoint is mounted at, there is no endpoint: that is a
     * bug, refused rather than guessed.
     */
    private current(): { endpoint: McpServerConfig; ctx: PlatformContext } {
        const ctx = getContext<PlatformContext>();

        if (CommonUtils.isUndefined(ctx)) {
            throw new InternalServerError('No MCP request is being handled.');
        }

        const path = pathOf(ctx.request.url);
        const endpoint = ObjectUtils.values(this.configService.config.mcpServers).find((entry) => entry.path === path);

        if (CommonUtils.isUndefined(endpoint)) {
            throw new InternalServerError(`No MCP endpoint is mounted at ${path}.`);
        }

        return { endpoint, ctx };
    }
}
