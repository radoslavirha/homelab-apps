import {
    JOB_OUTCOME_VALUE_FAILURE,
    JOB_OUTCOME_VALUE_SUCCESS,
    JOB_SKIP_REASON_VALUE_OVERRUN,
    recordJobSkip,
    runJob
} from '@radoslavirha/otel';
import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { getAsyncStore, Inject, ProviderScope, Scope, Service } from '@tsed/di';
import { RunOutcome } from '../models/RunOutcome.enum.js';
import {
    ATTR_KNOWLEDGE_BASE_FULL,
    INDEXER_TRACER_NAME,
    JOB_INDEX_KNOWLEDGE_BASES,
    recordIndexSuccess,
    SPAN_INDEX_RUN
} from '../otel/telemetry.js';
import { LOCK_INDEX } from '../storage/postgres/AdvisoryLock.js';
import { KnowledgeBaseRepository } from '../storage/postgres/KnowledgeBaseRepository.js';
import { PostgresService } from '../storage/postgres/PostgresService.js';
import { ConfigService } from './ConfigService.js';
import { IndexerService } from './IndexerService.js';

export interface RunRequest {
    /** Ids of the knowledge bases to index. */
    readonly knowledgeBases: readonly string[];
    /** Ignore the stored cursor and ask the source for everything. */
    readonly full: boolean;
    /**
     * Started by hand (`POST /reindex`). Only a manual run builds a knowledge base that was never
     * indexed or embeds a backlog above `indexer.maxScheduledEmbeddings`.
     */
    readonly manual: boolean;
}

/**
 * The background loop: a **self-rescheduling chain** — the next run is armed in `finally`,
 * `intervalMs` after the previous one ended, so runs in this pod never overlap; they run late
 * instead. `POST /reindex` cuts the wait short, or queues behind a run in progress.
 *
 * Across pods, a Postgres advisory lock keeps it to one indexer at a time. A pod that finds the
 * lock taken skips its run and records `job.run.skips{job.skip.reason=overrun}` — the one way
 * this chain can overrun, since another replica's run is not visible to its own timer.
 *
 * Each knowledge base is one `job.run.items` item: one KB failing does not fail the others,
 * and shows as an item failure inside a successful run.
 *
 * **Scheduled runs are incremental only.** A first build and a large embedding backlog cost the
 * Ollama node ~25 minutes of saturated CPU and its loaded chat model, so they happen only when
 * someone asks (`POST /reindex`): a scheduled run skips a knowledge base that was never indexed,
 * and leaves a backlog above `indexer.maxScheduledEmbeddings` pending.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class IndexingLoopService {
    private timer: NodeJS.Timeout | undefined;
    private running: Promise<void> | undefined;
    private pending: RunRequest | undefined;
    private stopped = false;
    private readonly log: BaseLogger;

    public constructor(
        private readonly configService: ConfigService,
        private readonly indexer: IndexerService,
        private readonly postgres: PostgresService,
        private readonly knowledgeBases: KnowledgeBaseRepository,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('INDEXER');
    }

    public get isRunning(): boolean {
        return CommonUtils.notUndefined(this.running);
    }

    public async $onReady(): Promise<void> {
        // A singleton can outlive an injector rebuild (tests); a new life starts unstopped.
        this.stopped = false;
        await this.restoreLastSuccess();

        const { enabled, initialDelayMs } = this.configService.config.indexer;

        if (enabled) {
            this.schedule(initialDelayMs);
        }
    }

    public async $onDestroy(): Promise<void> {
        this.stopped = true;
        clearTimeout(this.timer);
        await this.running;
    }

    /**
     * Starts a run now, or queues it behind the one in progress (requests queued meanwhile are
     * merged). Returns whether it had to queue.
     */
    public trigger(request: RunRequest): boolean {
        if (CommonUtils.notUndefined(this.running)) {
            this.pending = merge(this.pending, request);

            return true;
        }

        clearTimeout(this.timer);
        // Off the request's async context. Started inside it, the run — and every run the loop
        // schedules after it — would carry the request along, and with it the caller who asked.
        getAsyncStore().exit(() => {
            void this.start(request);
        });

        return false;
    }

    /** One run under the cross-pod lock. Exposed for tests; the loop and `trigger` call it. */
    public async run(request: RunRequest): Promise<void> {
        const knowledgeBases = this.configService.config.knowledgeBases
            .filter((kb) => request.knowledgeBases.includes(kb.id));

        const locked = await this.postgres.withTryAdvisoryLock(LOCK_INDEX, () => runJob(
            {
                name: JOB_INDEX_KNOWLEDGE_BASES,
                tracer: INDEXER_TRACER_NAME,
                spanName: SPAN_INDEX_RUN,
                attributes: { [ATTR_KNOWLEDGE_BASE_FULL]: request.full }
            },
            async ({ recordItem }) => {
                for (const kb of knowledgeBases) {
                    if (!request.manual && CommonUtils.isNull(await this.knowledgeBases.getCursor(kb.id))) {
                        this.log.warn('Knowledge base was never indexed; POST /reindex builds it.', {
                            event: 'INDEXER_NOT_BUILT',
                            knowledgeBase: kb.id
                        });
                        continue;
                    }

                    await this.knowledgeBases.recordRunStart(kb.id);

                    try {
                        const result = await this.indexer.index(kb, { full: request.full, manual: request.manual });
                        const lastSuccess = await this.knowledgeBases.recordRunEnd(kb.id, RunOutcome.Success, null);

                        recordIndexSuccess(kb.id, lastSuccess ?? new Date());
                        recordItem(JOB_OUTCOME_VALUE_SUCCESS);
                        this.log.info('Knowledge base indexed.', { event: 'INDEXER_RUN', knowledgeBase: kb.id, ...result });
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);

                        recordItem(JOB_OUTCOME_VALUE_FAILURE);
                        this.log.error('Indexing a knowledge base failed.', {
                            event: 'INDEXER_RUN_FAILED',
                            knowledgeBase: kb.id,
                            error: message
                        });
                        await this.knowledgeBases.recordRunEnd(kb.id, RunOutcome.Failure, message).catch(() => undefined);
                    }
                }
            }
        ));

        if (!locked.acquired) {
            recordJobSkip({ name: JOB_INDEX_KNOWLEDGE_BASES, reason: JOB_SKIP_REASON_VALUE_OVERRUN });
            this.log.info('Another pod is indexing; this run is skipped.', { event: 'INDEXER_SKIPPED' });
        }
    }

    private schedule(delayMs: number): void {
        if (this.stopped) {
            return;
        }

        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            void this.start({ knowledgeBases: this.allKnowledgeBases(), full: false, manual: false });
        }, delayMs);
        // A pending timer must not keep a draining process alive.
        this.timer.unref();
    }

    private async start(request: RunRequest): Promise<void> {
        this.running = this.run(request).catch((error: unknown) => {
            // Reached only when the database itself fails (the lock or a run record);
            // per-KB failures are handled inside the run.
            this.log.error('Indexing run failed.', {
                event: 'INDEXER_RUN_FAILED',
                error: error instanceof Error ? error.message : String(error)
            });
        });

        await this.running;
        this.running = undefined;

        if (this.stopped) {
            return;
        }

        const next = this.pending;

        this.pending = undefined;

        if (CommonUtils.notUndefined(next)) {
            await this.start(next);
        } else if (this.configService.config.indexer.enabled) {
            this.schedule(this.configService.config.indexer.intervalMs);
        }
    }

    /** Seeds the last-success gauge from the database, so a restart does not read as stale. */
    private async restoreLastSuccess(): Promise<void> {
        try {
            for (const row of await this.knowledgeBases.list(this.allKnowledgeBases())) {
                if (CommonUtils.notNil(row.lastSuccessAt)) {
                    recordIndexSuccess(row.id, row.lastSuccessAt);
                }
            }
        } catch (error) {
            this.log.warn('Could not read the last indexing runs.', {
                event: 'INDEXER_RESTORE_FAILED',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private allKnowledgeBases(): string[] {
        return this.configService.config.knowledgeBases.map((kb) => kb.id);
    }
}

const merge = (queued: RunRequest | undefined, request: RunRequest): RunRequest => CommonUtils.isUndefined(queued)
    ? request
    : {
        knowledgeBases: [...new Set([...queued.knowledgeBases, ...request.knowledgeBases])],
        full: queued.full || request.full,
        manual: queued.manual || request.manual
    };
