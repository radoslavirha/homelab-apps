import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { KnowledgeBaseApiEndpoint } from '../endpoints/knowledge-base-api/KnowledgeBaseApiEndpoint.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import type { ListKnowledgeBasesOutput } from '../models/ListKnowledgeBasesOutput.js';
import { ConfigService } from '../services/ConfigService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ListKnowledgeBasesHandler {
    public constructor(
        private readonly configService: ConfigService,
        private readonly api: KnowledgeBaseApiEndpoint,
        private readonly mapper: KnowledgeBaseMapper
    ) {}

    /** The knowledge bases the API lets this server read, described from config. */
    public async execute(): Promise<ListKnowledgeBasesOutput> {
        return this.mapper.toList(await this.api.status(), this.configService.config.knowledgeBases);
    }
}
