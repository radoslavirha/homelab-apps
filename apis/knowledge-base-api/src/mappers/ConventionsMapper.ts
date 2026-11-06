import { CommonUtils, MappingUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { ConventionsGetResponse } from '../models/ConventionsGetResponse.js';
import type { ConventionsFile } from '../services/ConventionsService.js';

/** A knowledge base's conventions file, read from its source, to `GET /conventions`. */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ConventionsMapper extends MappingUtils {
    /** `file` is `null` when the knowledge base names no conventions file. */
    public toResponse(kb: KnowledgeBaseConfig, file: ConventionsFile | null): ConventionsGetResponse {
        if (CommonUtils.isNull(file)) {
            return CommonUtils.buildModelStrict(ConventionsGetResponse, { kb: kb.id, path: null, markdown: null, version: null });
        }

        return CommonUtils.buildModelStrict(ConventionsGetResponse, {
            kb: kb.id,
            path: file.path,
            markdown: file.content,
            version: file.version
        });
    }
}
