import { CommonUtils, MappingUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { ReindexPostResponse } from '../models/ReindexPostResponse.js';

/** A started (or queued) run to the `POST /reindex` response. */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ReindexMapper extends MappingUtils {
    public toResponse(knowledgeBases: readonly string[], full: boolean, queued: boolean): ReindexPostResponse {
        return CommonUtils.buildModelStrict(ReindexPostResponse, { knowledgeBases: [...knowledgeBases], full, queued });
    }
}
