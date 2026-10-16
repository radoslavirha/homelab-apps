import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { ReindexMapper } from '../mappers/ReindexMapper.js';
import type { ReindexPostResponse } from '../models/ReindexPostResponse.js';
import { IndexingLoopService } from '../services/IndexingLoopService.js';
import { KnowledgeBaseAccessService } from '../services/KnowledgeBaseAccessService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ReindexPostHandler {
    public constructor(
        private readonly access: KnowledgeBaseAccessService,
        private readonly loop: IndexingLoopService,
        private readonly mapper: ReindexMapper
    ) {}

    /** Starts a run of the named knowledge bases (all the caller may read by default) and returns. */
    public execute(kb: string | undefined, full: boolean): ReindexPostResponse {
        const knowledgeBases = this.access.resolve(kb).map((candidate) => candidate.id);
        const queued = !CommonUtils.isEmpty(knowledgeBases) && this.loop.trigger({ knowledgeBases, full, manual: true });

        return this.mapper.toResponse(knowledgeBases, full, queued);
    }
}
