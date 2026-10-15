import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { StatusMapper } from '../mappers/StatusMapper.js';
import type { StatusGetResponse } from '../models/StatusGetResponse.js';
import { ConfigService } from '../services/ConfigService.js';
import { IndexingLoopService } from '../services/IndexingLoopService.js';
import { KnowledgeBaseAccessService } from '../services/KnowledgeBaseAccessService.js';
import { KnowledgeBaseRepository } from '../storage/postgres/KnowledgeBaseRepository.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class StatusGetHandler {
    public constructor(
        private readonly configService: ConfigService,
        private readonly access: KnowledgeBaseAccessService,
        private readonly knowledgeBases: KnowledgeBaseRepository,
        private readonly loop: IndexingLoopService,
        private readonly mapper: StatusMapper
    ) {}

    public async execute(): Promise<StatusGetResponse> {
        const readable = this.access.readable();
        const rows = new Map((await this.knowledgeBases.list(readable.map((kb) => kb.id))).map((row) => [row.id, row]));
        const states = await Promise.all(readable.map(async (config) => ({
            config,
            row: rows.get(config.id),
            stats: await this.knowledgeBases.stats(config.id),
            models: this.configService.config.embeddings.models
        })));
        const { enabled, intervalMs } = this.configService.config.indexer;

        return this.mapper.toResponse({ enabled, intervalMs, running: this.loop.isRunning }, states);
    }
}
