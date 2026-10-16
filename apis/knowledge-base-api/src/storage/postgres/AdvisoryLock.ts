/**
 * Postgres advisory locks this service takes, as `(namespace, key)` pairs for the two-integer
 * form of `pg_advisory_lock`. Advisory locks are scoped to the database already; the namespace
 * makes this service's keys recognisable in `pg_locks`.
 */
export interface AdvisoryLock {
    readonly namespace: number;
    readonly key: number;
}

/** 'kb' — this service's namespace. */
const NAMESPACE = 0x6b62;

/** Held while migrations run, so two pods starting together do not race the DDL. */
export const LOCK_MIGRATE: AdvisoryLock = { namespace: NAMESPACE, key: 1 };

/** Held for a whole indexing run: one indexer at a time across every replica. */
export const LOCK_INDEX: AdvisoryLock = { namespace: NAMESPACE, key: 2 };
