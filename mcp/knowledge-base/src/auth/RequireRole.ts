import { Intercept } from '@tsed/di';
import type { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { RoleInterceptor } from './RoleInterceptor.js';

/**
 * The least role a tool needs, as a level each endpoint maps to its own Authentik role. Goes on
 * every tool method — a spec fails for a tool without it. A caller below it gets the tool error
 * "Insufficient permissions."; reading tools take `Reader`, a writing tool would take `Editor`.
 */
export const RequireRole = (level: KnowledgeBaseRole): MethodDecorator => Intercept(RoleInterceptor, level);
