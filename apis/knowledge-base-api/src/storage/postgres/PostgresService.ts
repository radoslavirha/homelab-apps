import { readFileSync } from 'node:fs';
import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import pg from 'pg';
import type { DatabaseConfig } from '../../models/config/DatabaseConfig.js';
import { SslMode } from '../../models/config/SslMode.enum.js';
import { ConfigService } from '../../services/ConfigService.js';
import type { AdvisoryLock } from './AdvisoryLock.js';
import { SchemaMigrator } from './SchemaMigrator.js';

export type LockedResult<T> = { readonly acquired: true; readonly result: T } | { readonly acquired: false };

/**
 * The one connection pool to the `knowledge_base` database.
 *
 * Migrations run in `$onInit`, so the injector — and with it the HTTP listener and readiness —
 * waits for a migrated schema. A database that is down at boot fails the boot; the pod restarts
 * and tries again, which is the behaviour the other database-backed apps here have too.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class PostgresService {
    private pool: pg.Pool | undefined;
    private readonly log: BaseLogger;

    public constructor(
        private readonly configService: ConfigService,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('POSTGRES');
    }

    /**
     * Opens the pool and migrates. The pool lives from here to `$onDestroy`, not from the
     * constructor: Ts.ED may keep a singleton across an injector rebuild (tests do exactly that),
     * and an instance must come back to life rather than hold an ended pool.
     */
    public async $onInit(): Promise<void> {
        this.pool ??= this.createPool();

        const client = await this.pool.connect();

        try {
            await new SchemaMigrator(client, this.log).migrate({
                models: this.configService.config.embeddings.models,
                knowledgeBases: this.configService.config.knowledgeBases
            });
        } finally {
            client.release();
        }
    }

    public async $onDestroy(): Promise<void> {
        const pool = this.pool;

        this.pool = undefined;
        await pool?.end();
    }

    public query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<R>> {
        return this.open().query<R>(text, values);
    }

    /** Runs `fn` in one transaction on one connection; rolls back on any error. */
    public async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
        const client = await this.open().connect();

        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');

            return result;
        } catch (error) {
            await client.query('ROLLBACK').catch(() => undefined);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Runs `fn` only if the session-level advisory lock is free, holding it for the whole call.
     * The lock lives on one pooled connection for that time; if the pod dies, Postgres releases
     * it with the connection.
     */
    public async withTryAdvisoryLock<T>(lock: AdvisoryLock, fn: () => Promise<T>): Promise<LockedResult<T>> {
        const client = await this.open().connect();

        try {
            const { rows } = await client.query<{ locked: boolean }>(
                'SELECT pg_try_advisory_lock($1, $2) AS locked',
                [lock.namespace, lock.key]
            );

            if (!rows[0].locked) {
                return { acquired: false };
            }

            try {
                return { acquired: true, result: await fn() };
            } finally {
                await client.query('SELECT pg_advisory_unlock($1, $2)', [lock.namespace, lock.key]);
            }
        } finally {
            client.release();
        }
    }

    /** One round trip, for readiness. */
    public async ping(): Promise<void> {
        await this.open().query('SELECT 1');
    }

    private open(): pg.Pool {
        if (CommonUtils.isUndefined(this.pool)) {
            throw new Error('The Postgres pool is closed.');
        }

        return this.pool;
    }

    private createPool(): pg.Pool {
        const db = this.configService.config.database;
        const pool = new pg.Pool({
            host: db.host,
            port: db.port,
            database: db.database,
            user: db.user,
            password: db.password,
            ssl: PostgresService.ssl(db),
            max: db.pool.max,
            idleTimeoutMillis: db.pool.idleTimeoutMs,
            connectionTimeoutMillis: db.pool.connectionTimeoutMs,
            statement_timeout: db.statementTimeoutMs,
            application_name: this.configService.api.service
        });

        // An idle client losing its connection (a Postgres restart) emits 'error' on the pool.
        // Unhandled, that is an uncaught exception and the pod dies; handled, the pool simply
        // replaces the client on next use.
        pool.on('error', (error) => {
            this.log.warn('Idle Postgres connection failed.', { event: 'DB_POOL_ERROR', error: error.message });
        });

        return pool;
    }

    private static ssl(db: DatabaseConfig): pg.PoolConfig['ssl'] {
        switch (db.sslMode) {
            case SslMode.Disable:
                return false;
            case SslMode.Require:
                return { rejectUnauthorized: false };
            case SslMode.VerifyFull:
                return { rejectUnauthorized: true, ca: readFileSync(db.caFile!, 'utf-8') };
        }
    }
}
