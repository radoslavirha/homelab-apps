import { metrics, type Counter, type MeterProvider, type ObservableGauge } from '@opentelemetry/api';
import { getMeter } from '@radoslavirha/otel';
import { CommonUtils } from '@radoslavirha/utils';

/**
 * Every name this app puts on a span or a metric, in one place.
 *
 * Span names, attribute keys and `job.name` values are a query contract: a Grafana panel breaks
 * silently when one drifts. Constants make the drift a compile error.
 *
 * Cardinality: `knowledge_base.id` and `knowledge_base.embedding.model` are bounded by
 * configuration (a handful of KBs, one or two models each) — never a document id or a path.
 */

/** Instrumentation scope for the indexing loop. */
export const INDEXER_TRACER_NAME = 'knowledge-base-indexer';

/** Instrumentation scope for this app's own metrics. */
export const KNOWLEDGE_BASE_METER_NAME = 'knowledge-base';

/** Root span of one loop run, and the span of one knowledge base inside it. */
export const SPAN_INDEX_RUN = 'index knowledge bases';
export const SPAN_INDEX_KNOWLEDGE_BASE = 'index knowledge base';
export const SPAN_EMBED_CHUNKS = 'embed chunks';

/**
 * `job.name` of the indexing loop. One run indexes every configured KB; each KB is one
 * `job.run.items` item, so a KB that fails while the others succeed is visible as an item
 * failure inside a successful run.
 */
export const JOB_INDEX_KNOWLEDGE_BASES = 'index_knowledge_bases';

export const ATTR_KNOWLEDGE_BASE_ID = 'knowledge_base.id';
export const ATTR_KNOWLEDGE_BASE_SOURCE = 'knowledge_base.source';
export const ATTR_KNOWLEDGE_BASE_FULL = 'knowledge_base.index.full';
export const ATTR_DOCUMENT_CHANGE = 'knowledge_base.document.change';
export const ATTR_EMBEDDING_MODEL = 'knowledge_base.embedding.model';
export const ATTR_EMBEDDING_OUTCOME = 'knowledge_base.embedding.outcome';
export const ATTR_SEARCH_MODE = 'knowledge_base.search.mode';
/** Span-only quantities. */
export const ATTR_DOCUMENTS_UPSERTED = 'knowledge_base.documents.upserted';
export const ATTR_DOCUMENTS_DELETED = 'knowledge_base.documents.deleted';
export const ATTR_CHUNKS_EMBEDDED = 'knowledge_base.chunks.embedded';

export const EMBEDDING_OUTCOME_VALUE_SUCCESS = 'success';
export const EMBEDDING_OUTCOME_VALUE_FAILURE = 'failure';

export const SEARCH_MODE_VALUE_HYBRID = 'hybrid';
export const SEARCH_MODE_VALUE_VECTOR = 'vector';
export const SEARCH_MODE_VALUE_FULLTEXT = 'fulltext';

export const DOCUMENT_CHANGE_VALUE_UPSERT = 'upsert';
export const DOCUMENT_CHANGE_VALUE_UNCHANGED = 'unchanged';
export const DOCUMENT_CHANGE_VALUE_DELETE = 'delete';
export type DocumentChange =
    typeof DOCUMENT_CHANGE_VALUE_UPSERT | typeof DOCUMENT_CHANGE_VALUE_UNCHANGED | typeof DOCUMENT_CHANGE_VALUE_DELETE;

/**
 * Documents written or removed by the indexer. `unchanged` is a document the source reported
 * whose content was already stored — a full rebuild is mostly those.
 */
export const METRIC_DOCUMENTS_INDEXED = 'knowledge_base.documents.indexed';

/** Chunks sent to the embedder, by model and outcome. */
export const METRIC_CHUNKS_EMBEDDED = 'knowledge_base.chunks.embedded';

/**
 * Unix time of the last successful run per KB, in seconds. `time() - <this>` is the age of the
 * index — the number to alert on, since a loop that keeps failing still has a run rate.
 */
export const METRIC_INDEX_LAST_SUCCESS = 'knowledge_base.index.last_success';

/** Searches answered, by mode — `fulltext` rising means the embedder is unreachable (or no model is configured). */
export const METRIC_SEARCHES = 'knowledge_base.searches';

interface KnowledgeBaseInstruments {
    readonly documentsIndexed: Counter;
    readonly chunksEmbedded: Counter;
    readonly searches: Counter;
    readonly lastSuccess: ObservableGauge;
}

/** Last successful run per KB, observed by the gauge on every collection. */
const lastSuccessByKnowledgeBase = new Map<string, number>();

/**
 * Instruments, built once per meter provider — the metrics API has no proxy provider, so an
 * instrument created at module load would bind to the no-op provider forever (same reasoning as
 * `jobTelemetry` in `@radoslavirha/otel`).
 */
const instrumentsByProvider = new WeakMap<MeterProvider, KnowledgeBaseInstruments>();

export function knowledgeBaseInstruments(): KnowledgeBaseInstruments {
    const provider = metrics.getMeterProvider();
    const cached = instrumentsByProvider.get(provider);

    if (CommonUtils.notUndefined(cached)) {
        return cached;
    }

    const meter = getMeter(KNOWLEDGE_BASE_METER_NAME);
    const lastSuccess = meter.createObservableGauge(METRIC_INDEX_LAST_SUCCESS, {
        description: 'Unix time of the last successful indexing run of a knowledge base.',
        unit: 's'
    });

    lastSuccess.addCallback((result) => {
        for (const [kb, seconds] of lastSuccessByKnowledgeBase) {
            result.observe(seconds, { [ATTR_KNOWLEDGE_BASE_ID]: kb });
        }
    });

    const created: KnowledgeBaseInstruments = {
        documentsIndexed: meter.createCounter(METRIC_DOCUMENTS_INDEXED, {
            description: 'Documents written, left unchanged or deleted by the indexer.',
            unit: '{document}'
        }),
        chunksEmbedded: meter.createCounter(METRIC_CHUNKS_EMBEDDED, {
            description: 'Chunks sent to the embedding model.',
            unit: '{chunk}'
        }),
        searches: meter.createCounter(METRIC_SEARCHES, {
            description: 'Searches answered, by whether the vector leg ran.',
            unit: '{search}'
        }),
        lastSuccess
    };

    instrumentsByProvider.set(provider, created);

    return created;
}

/** Records a successful run for the gauge. `at` defaults to now. */
export function recordIndexSuccess(kb: string, at: Date = new Date()): void {
    // Building the instruments here registers the gauge callback even if nothing else has yet.
    knowledgeBaseInstruments();
    lastSuccessByKnowledgeBase.set(kb, Math.floor(at.getTime() / 1000));
}
