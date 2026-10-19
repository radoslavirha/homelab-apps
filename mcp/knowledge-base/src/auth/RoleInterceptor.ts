import { Interceptor, type InterceptorContext, type InterceptorMethods, type InterceptorNext } from '@tsed/di';
import type { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { McpEndpointService } from '../services/McpEndpointService.js';

/** Runs `@RequireRole`'s check before the tool: the caller must hold the endpoint's role for the tool's level. */
@Interceptor()
export class RoleInterceptor implements InterceptorMethods {
    public constructor(private readonly endpoint: McpEndpointService) {}

    public intercept(context: InterceptorContext<unknown, KnowledgeBaseRole>, next: InterceptorNext): unknown {
        this.endpoint.requireRole(context.options as KnowledgeBaseRole);

        return next();
    }
}
