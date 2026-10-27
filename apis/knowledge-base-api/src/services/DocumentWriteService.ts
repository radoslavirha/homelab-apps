import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils, StringUtils } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { Conflict, NotFound, NotImplemented } from '@tsed/exceptions';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { SourceAdapterFactory } from '../sources/SourceAdapterFactory.js';
import { SourceWriteRefusedError } from '../sources/SourceWriteRefusedError.js';
import type { SourceDeleteResult, SourceFile, SourceWriter, SourceWriteResult } from '../sources/SourceWriter.js';
import { IndexingLoopService } from './IndexingLoopService.js';

/** Who a write is for, and why — what the commit message says besides its subject. */
export interface WriteProvenance {
    /** The username of the person the caller writes for. */
    readonly onBehalfOf: string;
    /** The commit subject after `kb: ` — a title or a path. */
    readonly subject: string;
    /** A paragraph between the subject and the trailers. */
    readonly body?: string;
    /** Why a document is deleted. */
    readonly reason?: string;
}

/** A refused write is tried this many times when the source still holds the caller's version. */
const MAX_ATTEMPTS = 2;

/**
 * `name` of the entry in a refusal's `errors` that carries the document as the source holds it
 * now: `{ name: 'CURRENT', message, content, version }`. Ts.ED's exception body has no field of
 * its own for it, and `errors` is the list it already sends.
 */
export const CURRENT_ERROR_NAME = 'CURRENT';

/** Names the path through which every write arrives, in the commit's `Via:` trailer. */
const VIA = 'knowledge-base MCP';

/**
 * Every write to a knowledge base's source goes through here:
 *
 * - **One at a time in this pod.** GitHub's contents API conflicts when writes to one branch run
 *   in parallel, so they are queued.
 * - **A refusal is answered from the source, not the index.** The source checks the caller's
 *   version; when it refuses, the document is read as it is now and the refusal explained:
 *   another version → `409` with the current document in `errors`; gone → `404`; a create of a
 *   document that exists → `409` with it too. When the source still holds the caller's version, the branch moved
 *   under the write (a write from elsewhere): it is tried once more.
 * - **A write starts an incremental indexing run** for its knowledge base, without waiting for it,
 *   so `GET /documents` and search see it within seconds. The version a write returns is valid
 *   at once; the caller does not wait for the run.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class DocumentWriteService {
    private queue: Promise<unknown> = Promise.resolve();
    private readonly log: BaseLogger;

    public constructor(
        private readonly sources: SourceAdapterFactory,
        private readonly loop: IndexingLoopService,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('DOCUMENT_WRITE');
    }

    /** The document as the source holds it now, or `null`. */
    public read(kb: KnowledgeBaseConfig, id: string): Promise<SourceFile | null> {
        return this.writer(kb).read(id);
    }

    /** Creates `id` when `version` is `null`, otherwise rewrites the document at that version. */
    public write(
        kb: KnowledgeBaseConfig,
        id: string,
        content: string,
        version: string | null,
        provenance: WriteProvenance
    ): Promise<SourceWriteResult> {
        const writer = this.writer(kb);
        const message = this.commitMessage(provenance);

        return this.run(kb, writer, id, version, () => writer.write(id, content, version, message));
    }

    public delete(kb: KnowledgeBaseConfig, id: string, version: string, provenance: WriteProvenance): Promise<SourceDeleteResult> {
        const writer = this.writer(kb);
        const message = this.commitMessage(provenance);

        return this.run(kb, writer, id, version, () => writer.delete(id, version, message));
    }

    /**
     * `kb: <subject>`, the body, then the trailers. The trailers are the last paragraph, so a body
     * that imitates one is not read as one.
     */
    public commitMessage(provenance: WriteProvenance): string {
        const trailers = [
            `On-behalf-of: ${provenance.onBehalfOf}`,
            `Via: ${VIA}`,
            ...(StringUtils.isNotEmpty(provenance.reason) ? [`Reason: ${oneLine(provenance.reason)}`] : [])
        ];

        return [
            `kb: ${oneLine(provenance.subject)}`,
            ...(StringUtils.isNotEmpty(provenance.body) ? [provenance.body.trim()] : []),
            trailers.join('\n')
        ].join('\n\n');
    }

    private writer(kb: KnowledgeBaseConfig): SourceWriter {
        const writer = this.sources.get(kb).writer;

        if (CommonUtils.isUndefined(writer)) {
            throw new NotImplemented(`Knowledge base ${kb.id} has a ${kb.source} source, which cannot be written.`);
        }

        return writer;
    }

    private run<T extends SourceDeleteResult>(
        kb: KnowledgeBaseConfig,
        writer: SourceWriter,
        id: string,
        version: string | null,
        write: () => Promise<T>
    ): Promise<T> {
        const result = this.queue.then(async () => {
            for (let attempt = 1; ; attempt++) {
                try {
                    const written = await write();

                    this.log.info('Document written.', { event: 'DOCUMENT_WRITTEN', knowledgeBase: kb.id, id, commit: written.commit, attempt });

                    return written;
                } catch (error) {
                    if (!(error instanceof SourceWriteRefusedError)) {
                        throw error;
                    }

                    const current = await writer.read(id);

                    this.log.info('Write refused by the source.', {
                        event: 'DOCUMENT_WRITE_REFUSED',
                        knowledgeBase: kb.id,
                        id,
                        attempt,
                        exists: CommonUtils.notNull(current)
                    });
                    this.explain(id, version, current, attempt);
                }
            }
        });

        // The next write waits for this one, whatever its outcome.
        this.queue = result.catch(() => undefined);

        return result.then((written) => {
            this.index(kb);

            return written;
        });
    }

    /** Throws the answer to a refusal; returns when the write is worth one more try. */
    private explain(id: string, version: string | null, current: SourceFile | null, attempt: number): void {
        const retry = attempt < MAX_ATTEMPTS;

        if (CommonUtils.isNull(version)) {
            if (CommonUtils.notNull(current)) {
                throw conflict(`${id} already exists. Apply your change to the current document and write it with its version.`, current);
            }

            if (!retry) {
                throw new Conflict(`The source refused to create ${id} twice, though it does not exist. Try again.`);
            }

            return;
        }

        if (CommonUtils.isNull(current)) {
            throw new NotFound(`${id} no longer exists.`);
        }

        if (current.version !== version || !retry) {
            throw conflict(`${id} has changed since version ${version}. Apply your change to the current document and write it with its version.`, current);
        }
    }

    /** Starts an incremental run for the knowledge base; the write does not wait for it. */
    private index(kb: KnowledgeBaseConfig): void {
        this.loop.trigger({ knowledgeBases: [kb.id], full: false, manual: false }).catch((error: unknown) => {
            this.log.warn('Could not start an indexing run after a write; the next scheduled run picks it up.', {
                event: 'DOCUMENT_WRITE_INDEX_FAILED',
                knowledgeBase: kb.id,
                error: error instanceof Error ? error.message : String(error)
            });
        });
    }
}

/** A `409` whose `errors` hold the document as the source has it, so the caller can apply its change to that and retry. */
const conflict = (message: string, current: SourceFile): Conflict => Object.assign(new Conflict(message), {
    errors: [{ name: CURRENT_ERROR_NAME, message: 'The document as the source holds it now.', content: current.content, version: current.version }]
});

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();
