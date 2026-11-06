import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { ConventionsMapper } from '../mappers/ConventionsMapper.js';
import type { ConventionsGetResponse } from '../models/ConventionsGetResponse.js';
import { ConventionsService } from '../services/ConventionsService.js';
import { KnowledgeBaseAccessService } from '../services/KnowledgeBaseAccessService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ConventionsGetHandler {
    public constructor(
        private readonly access: KnowledgeBaseAccessService,
        private readonly conventions: ConventionsService,
        private readonly mapper: ConventionsMapper
    ) {}

    public async execute(kb: string): Promise<ConventionsGetResponse> {
        // One id (the route's pattern): `resolve` answers the same 404 for an unknown and an unreadable KB.
        const [config] = this.access.resolve(kb);

        return this.mapper.toResponse(config, await this.conventions.read(config));
    }
}
