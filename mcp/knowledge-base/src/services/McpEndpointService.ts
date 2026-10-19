import { CommonUtils, ObjectUtils } from '@radoslavirha/utils';
import { getContext, Injectable, ProviderScope, Scope } from '@tsed/di';
import { InternalServerError } from '@tsed/exceptions';
import type { PlatformContext } from '@tsed/platform-http';
import { ConfigService } from './ConfigService.js';

/** A request URL's path, without the query and without a trailing slash Express would also route. */
const pathOf = (url: string): string => {
    const path = url.split('?')[0];

    return path.length > 1 ? path.replace(/\/+$/, '') : path;
};

/**
 * The knowledge base of the MCP endpoint a tool call came in on.
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

    /**
     * The `kb` of the endpoint handling this request. Outside a request, or on a path no endpoint
     * is mounted at, there is none: that is a bug, refused rather than guessed.
     */
    public knowledgeBase(): string {
        const ctx = getContext<PlatformContext>();

        if (CommonUtils.isUndefined(ctx)) {
            throw new InternalServerError('No MCP request is being handled.');
        }

        const path = pathOf(ctx.request.url);
        const server = ObjectUtils.values(this.configService.config.mcpServers).find((entry) => entry.path === path);

        if (CommonUtils.isUndefined(server)) {
            throw new InternalServerError(`No MCP endpoint is mounted at ${path}.`);
        }

        return server.kb;
    }
}
