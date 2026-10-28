import { withSpan } from '@radoslavirha/otel';
import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils, StringUtils } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { DocumentMapper } from '../mappers/DocumentMapper.js';
import { ChunkingMode } from '../models/ChunkingMode.enum.js';
import { ContentType } from '../models/config/ContentType.enum.js';
import type { EmbeddingModelConfig } from '../models/config/EmbeddingsConfig.js';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import {
    ATTR_CHUNKS_EMBEDDED,
    ATTR_DOCUMENT_CHANGE,
    ATTR_DOCUMENTS_DELETED,
    ATTR_DOCUMENTS_UPSERTED,
    ATTR_EMBEDDING_MODEL,
    ATTR_EMBEDDING_OUTCOME,
    ATTR_KNOWLEDGE_BASE_FULL,
    ATTR_KNOWLEDGE_BASE_ID,
    ATTR_KNOWLEDGE_BASE_SOURCE,
    DOCUMENT_CHANGE_VALUE_DELETE,
    DOCUMENT_CHANGE_VALUE_UNCHANGED,
    EMBEDDING_OUTCOME_VALUE_FAILURE,
    EMBEDDING_OUTCOME_VALUE_SUCCESS,
    INDEXER_TRACER_NAME,
    knowledgeBaseInstruments,
    SPAN_EMBED_CHUNKS,
    SPAN_INDEX_KNOWLEDGE_BASE
} from '../otel/telemetry.js';
import type { SourceDocument } from '../sources/SourceDocument.js';
import { SourceAdapterFactory } from '../sources/SourceAdapterFactory.js';
import { ChunkDTO } from '../storage/postgres/dto/ChunkDTO.js';
import { DocumentRepository } from '../storage/postgres/DocumentRepository.js';
import { EmbeddingRepository } from '../storage/postgres/EmbeddingRepository.js';
import { KnowledgeBaseRepository } from '../storage/postgres/KnowledgeBaseRepository.js';
import { ConfigService } from './ConfigService.js';
import { EmbeddingService } from './EmbeddingService.js';
import { FrontmatterService } from './FrontmatterService.js';
import { MarkdownChunkerService } from './MarkdownChunkerService.js';

export interface IndexResult {
    readonly cursor: string;
    readonly complete: boolean;
    readonly upserted: number;
    readonly unchanged: number;
    readonly deleted: number;
    /** Chunks given a vector in this run, per model — copied from a twin or embedded. */
    readonly embedded: Readonly<Record<string, number>>;
    /** Models whose embedding stopped early (embedder unreachable); their chunks stay pending. */
    readonly embeddingFailed: readonly string[];
    /** Models whose backlog was too large for a scheduled run; they wait for `POST /reindex`. */
    readonly embeddingDeferred: readonly string[];
}

export interface IndexOptions {
    /** Ignore the stored cursor and ask the source for everything. */
    readonly full: boolean;
    /** Started by hand (`POST /reindex`): no limit on the embedding backlog. */
    readonly manual: boolean;
    /**
     * Stops the run between documents and embedding batches, and cancels the source and embedder
     * call in flight. The run then throws the signal's reason.
     */
    readonly signal?: AbortSignal;
}

/**
 * Indexes one knowledge base: what the source reports changed → chunks → the database →
 * vectors for chunks that have none.
 *
 * The order is what makes a crash harmless. Documents are written first, deletions next, and
 * the cursor last, so an interrupted run repeats from the old cursor — every step is idempotent.
 * Embedding comes after the cursor and never fails the run: with the embedder down, text is
 * searchable at once and the vectors catch up on a later run, because "pending" is simply "no
 * row for this model", not a list kept somewhere. The same order makes stopping safe: an aborted
 * run is an interrupted one, whichever step it stopped at.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class IndexerService {
    private readonly log: BaseLogger;

    public constructor(
        private readonly configService: ConfigService,
        private readonly sources: SourceAdapterFactory,
        private readonly knowledgeBases: KnowledgeBaseRepository,
        private readonly documents: DocumentRepository,
        private readonly embeddingRepository: EmbeddingRepository,
        private readonly embeddings: EmbeddingService,
        private readonly frontmatter: FrontmatterService,
        private readonly chunker: MarkdownChunkerService,
        private readonly documentMapper: DocumentMapper,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('INDEXER');
    }

    public index(kb: KnowledgeBaseConfig, options: IndexOptions): Promise<IndexResult> {
        return withSpan({
            name: SPAN_INDEX_KNOWLEDGE_BASE,
            tracer: INDEXER_TRACER_NAME,
            attributes: {
                [ATTR_KNOWLEDGE_BASE_ID]: kb.id,
                [ATTR_KNOWLEDGE_BASE_SOURCE]: kb.source,
                [ATTR_KNOWLEDGE_BASE_FULL]: options.full
            }
        }, async (span) => {
            const instruments = knowledgeBaseInstruments();
            const cursor = options.full ? null : await this.knowledgeBases.getCursor(kb.id);
            const changes = await this.sources.get(kb).changes(cursor, options.signal);
            let upserted = 0;
            let unchanged = 0;

            for (const document of changes.upserts) {
                options.signal?.throwIfAborted();

                // Postgres refuses a NUL byte in text and jsonb on every run, so one such file (a
                // UTF-16 markdown file, say) would fail the knowledge base forever. Skip only that:
                // any other storage error is worth a retry and still fails the run, cursor untouched.
                // Its id stays in `upsertedIds`, so a complete snapshot does not delete it either.
                if (this.holdsNul(document)) {
                    this.log.error('Document holds a NUL byte, which Postgres cannot store; skipped.', {
                        event: 'INDEXER_DOCUMENT_SKIPPED',
                        knowledgeBase: kb.id,
                        externalId: document.externalId
                    });
                    continue;
                }

                const change = await this.documents.upsert(
                    this.documentMapper.sourceToStorage(kb.id, document),
                    kb.tsConfig,
                    this.chunk(kb, document)
                );

                if (change === DOCUMENT_CHANGE_VALUE_UNCHANGED) {
                    unchanged++;
                } else {
                    upserted++;
                }
                instruments.documentsIndexed.add(1, { [ATTR_KNOWLEDGE_BASE_ID]: kb.id, [ATTR_DOCUMENT_CHANGE]: change });
            }

            // Before deletions: a renamed file's old chunks still hold the vectors its new ones can reuse.
            const embedded: Record<string, number> = {};

            for (const model of kb.models) {
                embedded[model] = await this.embeddingRepository.copyByHash(kb.id, model);
            }

            options.signal?.throwIfAborted();

            const upsertedIds = changes.upserts.map((document) => document.externalId);
            // A path can be both: git pairs a rewritten file with another as a rename, so the
            // source of the rename is reported deleted while it still exists at head.
            const deleted = changes.complete
                ? await this.documents.deleteAllExcept(kb.id, upsertedIds)
                : await this.documents.delete(kb.id, changes.deletes.filter((id) => !upsertedIds.includes(id)));

            if (deleted > 0) {
                instruments.documentsIndexed.add(deleted, { [ATTR_KNOWLEDGE_BASE_ID]: kb.id, [ATTR_DOCUMENT_CHANGE]: DOCUMENT_CHANGE_VALUE_DELETE });
            }

            await this.knowledgeBases.setCursor(kb.id, changes.cursor);

            const embeddingFailed: string[] = [];
            const embeddingDeferred: string[] = [];
            const { maxScheduledEmbeddings } = this.configService.config.indexer;

            for (const name of kb.models) {
                if (!options.manual) {
                    const backlog = await this.embeddingRepository.countPending(kb.id, name);

                    if (backlog > maxScheduledEmbeddings) {
                        this.log.warn('Embedding backlog too large for a scheduled run; POST /reindex to embed it.', {
                            event: 'INDEXER_EMBED_DEFERRED',
                            knowledgeBase: kb.id,
                            model: name,
                            pending: backlog,
                            limit: maxScheduledEmbeddings
                        });
                        embeddingDeferred.push(name);
                        continue;
                    }
                }

                const count = await this.embedPending(kb, this.embeddings.model(name)!, options.signal);

                embedded[name] += count.embedded;

                if (count.failed) {
                    embeddingFailed.push(name);
                }
            }

            span.setAttributes({
                [ATTR_DOCUMENTS_UPSERTED]: upserted,
                [ATTR_DOCUMENTS_DELETED]: deleted,
                [ATTR_CHUNKS_EMBEDDED]: Object.values(embedded).reduce((sum, count) => sum + count, 0)
            });

            return {
                cursor: changes.cursor,
                complete: changes.complete,
                upserted,
                unchanged,
                deleted,
                embedded,
                embeddingFailed,
                embeddingDeferred
            };
        });
    }

    /** Chunks one document the way its KB's content type says. */
    public chunk(kb: KnowledgeBaseConfig, document: SourceDocument): ChunkDTO[] {
        switch (kb.contentType) {
            case ContentType.Markdown:
                return this.chunker.chunk(this.frontmatter.parse(document.content).body, {
                    externalId: document.externalId,
                    title: document.title,
                    mode: document.chunking ?? ChunkingMode.Sections,
                    maxChars: kb.chunking.maxChars,
                    overlapChars: kb.chunking.overlapChars
                }).map((chunk) => CommonUtils.buildModelStrict(ChunkDTO, {
                    ord: chunk.ord,
                    heading: chunk.heading,
                    anchor: chunk.anchor,
                    body: chunk.body,
                    hash: chunk.hash
                }));
        }
    }

    /** Whether any text of the document, its metadata keys and values included, holds a NUL byte. */
    private holdsNul(document: SourceDocument): boolean {
        let found = false;

        JSON.stringify(document, (key: string, value: string | object | null) => {
            if (key.includes('\0') || (StringUtils.isString(value) && value.includes('\0'))) {
                found = true;
            }

            return value;
        });

        return found;
    }

    /**
     * Embeds every chunk of the KB that has no vector from `model`, a batch at a time. Stops at
     * the first embedder failure: the rest stays pending for the next run. An abort is not an
     * embedder failure: it ends the run.
     */
    private embedPending(kb: KnowledgeBaseConfig, model: EmbeddingModelConfig, signal?: AbortSignal): Promise<{ embedded: number; failed: boolean }> {
        return withSpan({
            name: SPAN_EMBED_CHUNKS,
            tracer: INDEXER_TRACER_NAME,
            attributes: { [ATTR_KNOWLEDGE_BASE_ID]: kb.id, [ATTR_EMBEDDING_MODEL]: model.name }
        }, async (span) => {
            const { batchSize } = this.configService.config.embeddings;
            const counter = knowledgeBaseInstruments().chunksEmbedded;
            let embedded = 0;

            for (;;) {
                signal?.throwIfAborted();

                const batch = await this.embeddingRepository.pending(kb.id, model.name, batchSize);

                if (CommonUtils.isEmpty(batch)) {
                    break;
                }

                let vectors: number[][];

                try {
                    vectors = await this.embeddings.embedDocuments(model, batch, signal);
                } catch (error) {
                    signal?.throwIfAborted();
                    counter.add(batch.length, { [ATTR_EMBEDDING_MODEL]: model.name, [ATTR_EMBEDDING_OUTCOME]: EMBEDDING_OUTCOME_VALUE_FAILURE });
                    this.log.warn('Embedding failed; chunks stay pending until the next run.', {
                        event: 'INDEXER_EMBED_FAILED',
                        knowledgeBase: kb.id,
                        model: model.name,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    span.setAttribute(ATTR_CHUNKS_EMBEDDED, embedded);

                    return { embedded, failed: true };
                }

                const inserted = await this.embeddingRepository.insert(
                    model.name,
                    batch.map((chunk, index) => ({ chunkId: chunk.id, vector: vectors[index] }))
                );

                counter.add(batch.length, { [ATTR_EMBEDDING_MODEL]: model.name, [ATTR_EMBEDDING_OUTCOME]: EMBEDDING_OUTCOME_VALUE_SUCCESS });
                embedded += inserted;

                // Nothing stored means every chunk of the batch vanished meanwhile; asking again
                // would loop on the same rows forever.
                if (inserted === 0) {
                    break;
                }
            }

            span.setAttribute(ATTR_CHUNKS_EMBEDDED, embedded);

            return { embedded, failed: false };
        });
    }
}
