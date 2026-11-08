import { Intercept } from '@tsed/di';
import { RoleInterceptor } from '../auth/RoleInterceptor.js';

/** Tool methods that declare no `KnowledgeBaseRole`: one intercepted with another value, one bare. */
export class UnleveledTool {
    @Intercept(RoleInterceptor, 'ADMIN')
    public odd(): void {}

    public bare(): void {}
}
