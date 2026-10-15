import { PlatformTest } from '@tsed/platform-http/testing';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '../../services/ConfigService.js';
import { LOCK_INDEX } from './AdvisoryLock.js';
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
