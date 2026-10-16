import { PrincipalService } from '@radoslavirha/tsed-auth';
import { CommonUtils, DefaultsUtil, StringUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { NotFound } from '@tsed/exceptions';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { ConfigService } from './ConfigService.js';

/**
 * Which knowledge bases a caller may read: those whose `readers` share a role with the caller's
 * token. The route's own role floor (`knowledge-base-api.reader`) decides whether the caller
 * gets here at all; this decides what they see once they do. The caller is the one of the request
 * being handled, read from `PrincipalService` rather than passed down from the controller.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class KnowledgeBaseAccessService {
    public constructor(
        private readonly configService: ConfigService,
        private readonly principals: PrincipalService
    ) {}

    public readable(): KnowledgeBaseConfig[] {
        const { roles } = this.principals.require();

        return this.configService.config.knowledgeBases
            .filter((kb) => kb.readers.some((role) => roles.includes(role)));
    }

    /**
     * The KBs named in `requested` (comma-separated), or every readable one when it is empty.
     *
     * A KB that does not exist and one the caller may not read answer the same `404`, so the
     * response does not tell anyone which knowledge bases exist.
     */
    public resolve(requested: string | undefined): KnowledgeBaseConfig[] {
        const readable = this.readable();
        const ids = [...new Set(DefaultsUtil.string(requested, '').split(',').map((id) => id.trim()).filter((id) => StringUtils.isNotEmpty(id)))];

        if (CommonUtils.isEmpty(ids)) {
            return readable;
        }

        return ids.map((id) => {
            const kb = readable.find((candidate) => candidate.id === id);

            if (CommonUtils.isUndefined(kb)) {
                throw new NotFound('Knowledge base not found.');
            }

            return kb;
        });
    }
}
