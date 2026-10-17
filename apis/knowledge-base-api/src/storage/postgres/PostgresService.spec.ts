import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../../services/ConfigService.js';
import { type AdvisoryLock, LOCK_INDEX } from './AdvisoryLock.js';
import { PostgresService } from './PostgresService.js';

describe('PostgresService', () => {
    let postgres: PostgresService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        postgres = PlatformTest.get<PostgresService>(PostgresService);
    });
    afterEach(PlatformTest.reset);

    describe('transaction', () => {
        it('commits what the callback wrote', async () => {
            expect.assertions(1);

            await postgres.transaction((client) => client.query("UPDATE knowledge_bases SET cursor = 'tx' WHERE id = 'dev'"));

            expect((await postgres.query<{ cursor: string }>("SELECT cursor FROM knowledge_bases WHERE id = 'dev'")).rows[0].cursor).toBe('tx');
        });

        it('rolls back everything when the callback throws', async () => {
            expect.assertions(2);

            await postgres.query("UPDATE knowledge_bases SET cursor = 'before' WHERE id = 'dev'");

            await expect(postgres.transaction(async (client) => {
                await client.query("UPDATE knowledge_bases SET cursor = 'inside' WHERE id = 'dev'");
                throw new Error('boom');
            })).rejects.toThrow('boom');
            expect((await postgres.query<{ cursor: string }>("SELECT cursor FROM knowledge_bases WHERE id = 'dev'")).rows[0].cursor).toBe('before');
        });
    });

    describe('withTryAdvisoryLock', () => {
        it('runs the callback holding the lock and releases it afterwards', async () => {
            expect.assertions(2);

            expect(await postgres.withTryAdvisoryLock(LOCK_INDEX, () => Promise.resolve('done'))).toEqual({ acquired: true, result: 'done' });
            expect(await postgres.withTryAdvisoryLock(LOCK_INDEX, () => Promise.resolve('again'))).toEqual({ acquired: true, result: 'again' });
        });

        it('does not run the callback while another session holds the lock', async () => {
            expect.assertions(1);

            const db = PlatformTest.get<ConfigService>(ConfigService).config.database;
            const other = new pg.Client({ host: db.host, port: db.port, database: db.database, user: db.user, password: db.password });

            await other.connect();
            await other.query('SELECT pg_advisory_lock($1, $2)', [LOCK_INDEX.namespace, LOCK_INDEX.key]);

            try {
                expect(await postgres.withTryAdvisoryLock(LOCK_INDEX, () => Promise.resolve('never'))).toEqual({ acquired: false });
            } finally {
                await other.end();
            }
        });

        it('releases the lock when the callback throws', async () => {
            expect.assertions(2);

            await expect(postgres.withTryAdvisoryLock(LOCK_INDEX, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
            expect(await postgres.withTryAdvisoryLock(LOCK_INDEX, () => Promise.resolve('free'))).toEqual({ acquired: true, result: 'free' });
        });
    });

    describe('a connection lost while in use', () => {
        /** Terminates the backend holding `lock` from another connection, as a Postgres restart would. */
        const terminateHolderOf = async (lock: AdvisoryLock): Promise<void> => {
            const { rows } = await postgres.query<{ pid: number }>(
                "SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND classid = $1 AND objid = $2 AND granted",
                [lock.namespace, lock.key]
            );
            const [{ pid }] = rows;

            await postgres.query('SELECT pg_terminate_backend($1)', [pid]);
            await vi.waitFor(async () => {
                const { rows: alive } = await postgres.query('SELECT 1 FROM pg_stat_activity WHERE pid = $1', [pid]);

                if (!CommonUtils.isEmpty(alive)) {
                    throw new Error('The backend is still running.');
                }
            });
            // The backend is gone; give the client a moment to read the socket's end.
            await new Promise((resolve) => setTimeout(resolve, 100));
        };

        it('rejects the transaction rather than crashing the process, and the pool recovers', async () => {
            expect.assertions(2);

            await expect(postgres.transaction((client) => client.query('SELECT pg_terminate_backend(pg_backend_pid())'))).rejects.toThrow();
            await expect(postgres.ping()).resolves.toBeUndefined();
        });

        it('tells the locked work its lock is gone, lets it finish, and leaves the lock free', async () => {
            expect.assertions(4);

            const result = await postgres.withTryAdvisoryLock(LOCK_INDEX, async (lockLost) => {
                expect(lockLost.aborted).toBe(false);
                await terminateHolderOf(LOCK_INDEX);
                // An AbortError, so the GitHub and Ollama calls it cancels are not retried.
                expect(lockLost.reason).toMatchObject({ name: 'AbortError', message: expect.stringContaining('The Postgres connection was lost') });

                return 'finished';
            });

            expect(result).toEqual({ acquired: true, result: 'finished' });
            expect(await postgres.withTryAdvisoryLock(LOCK_INDEX, () => Promise.resolve('again'))).toEqual({ acquired: true, result: 'again' });
        });
    });

    describe('lifecycle', () => {
        it('refuses queries once destroyed, and opens a new pool on the next init', async () => {
            expect.assertions(2);

            await postgres.$onDestroy();
            await expect(postgres.ping()).rejects.toThrow('The Postgres pool is closed.');

            await postgres.$onInit();
            await expect(postgres.ping()).resolves.toBeUndefined();
        });
    });
});
