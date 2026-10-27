import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { GitHubEndpoint } from '../endpoints/github/GitHubEndpoint.js';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { KnowledgeBaseSource } from '../models/config/KnowledgeBaseSource.enum.js';
import { ConfigService } from '../services/ConfigService.js';
import { GitDocumentParser } from './git/GitDocumentParser.js';
import { GitHubRepositoryService } from './git/GitHubRepositoryService.js';
import { GitSourceAdapter } from './git/GitSourceAdapter.js';
import type { SourceAdapter } from './SourceAdapter.js';

/**
 * One {@link SourceAdapter} per configured knowledge base. A new source is a new `case` here and
 * a new member of `KnowledgeBaseConfigSchema` — nothing downstream changes.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class SourceAdapterFactory {
    private readonly adapters = new Map<string, SourceAdapter>();
    private readonly log: BaseLogger;

    public constructor(
        private readonly configService: ConfigService,
        private readonly repositories: GitHubRepositoryService,
        private readonly github: GitHubEndpoint,
        private readonly parser: GitDocumentParser,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('GIT_SOURCE');
    }

    public get(kb: KnowledgeBaseConfig): SourceAdapter {
        let adapter = this.adapters.get(kb.id);

        if (CommonUtils.isUndefined(adapter)) {
            adapter = this.create(kb);
            this.adapters.set(kb.id, adapter);
        }

        return adapter;
    }

    private create(kb: KnowledgeBaseConfig): SourceAdapter {
        switch (kb.source) {
            case KnowledgeBaseSource.Git:
                return new GitSourceAdapter(
                    kb,
                    this.repositories,
                    this.github,
                    this.parser,
                    this.configService.config.indexer.fetchConcurrency,
                    this.log
                );
        }
    }
}
