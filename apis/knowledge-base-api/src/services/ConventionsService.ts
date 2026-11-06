import { CommonUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { InternalServerError, NotImplemented } from '@tsed/exceptions';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { SourceAdapterFactory } from '../sources/SourceAdapterFactory.js';
import type { SourceFile } from '../sources/SourceWriter.js';

/** A knowledge base's conventions file as its source holds it now. */
export interface ConventionsFile extends SourceFile {
    /** Where it is in the source: the knowledge base's `conventionsPath`. */
    readonly path: string;
}

/**
 * Reads a knowledge base's conventions — the file its `conventionsPath` names — from the source,
 * not from the index: the file is usually outside `git.include` (a `README.md` at the root), and
 * an agent asks for it rarely, before writing, so a live read costs little.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class ConventionsService {
    public constructor(private readonly sources: SourceAdapterFactory) {}

    /**
     * `null` when the knowledge base names no conventions file — a normal answer. A file that is
     * named but missing is a configuration mistake, and fails rather than reading as "none".
     */
    public async read(kb: KnowledgeBaseConfig): Promise<ConventionsFile | null> {
        const path = kb.conventionsPath;

        if (CommonUtils.isUndefined(path)) {
            return null;
        }

        const source = this.sources.get(kb);

        if (CommonUtils.isUndefined(source.file)) {
            throw new NotImplemented(`Knowledge base ${kb.id} has a ${kb.source} source, which cannot read its conventions file.`);
        }

        const file = await source.file(path);

        if (CommonUtils.isNull(file)) {
            throw new InternalServerError(`Knowledge base ${kb.id} names ${path} as its conventions, but its source holds no such file.`);
        }

        return { path, content: file.content, version: file.version };
    }
}
