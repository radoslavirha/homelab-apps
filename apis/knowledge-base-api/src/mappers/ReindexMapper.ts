import { CommonUtils, MappingUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { ReindexPostResponse } from '../models/ReindexPostResponse.js';
import { ReindexState } from '../models/ReindexState.enum.js';
import { RunStart } from '../models/RunStart.enum.js';

/** A started or queued run to the `POST /reindex` response. A skipped one has no response body. */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ReindexMapper extends MappingUtils {
    public toResponse(knowledgeBases: readonly string[], full: boolean, start: RunStart.Started | RunStart.Queued): ReindexPostResponse {
        return CommonUtils.buildModelStrict(ReindexPostResponse, {
            knowledgeBases: [...knowledgeBases],
            full,
            state: start === RunStart.Started ? ReindexState.Started : ReindexState.Queued
        });
    }
}
