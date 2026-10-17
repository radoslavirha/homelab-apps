import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { Conflict, NotFound } from '@tsed/exceptions';
import { ReindexMapper } from '../mappers/ReindexMapper.js';
import type { ReindexPostResponse } from '../models/ReindexPostResponse.js';
import { RunStart } from '../models/RunStart.enum.js';
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

    /**
     * Starts a run of the named knowledge bases (all the caller may read by default), or queues it
     * behind the run in progress in this pod, and says which. Another pod indexing is a `409`:
     * nothing was started, and saying `202` would claim a run that never happens.
     */
    public async execute(kb: string | undefined, full: boolean): Promise<ReindexPostResponse> {
        const knowledgeBases = this.access.resolve(kb).map((candidate) => candidate.id);

        if (CommonUtils.isEmpty(knowledgeBases)) {
            throw new NotFound('Knowledge base not found.');
        }

        const start = await this.loop.trigger({ knowledgeBases, full, manual: true });

        if (start === RunStart.Skipped) {
            throw new Conflict('Another pod is indexing; nothing was started. Try again when its run ends.');
        }

        return this.mapper.toResponse(knowledgeBases, full, start);
    }
}
