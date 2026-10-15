import { randomUUID } from 'node:crypto';
import { CommonUtils } from '@radoslavirha/utils';
import pg from 'pg';

/**
 * Runs before each test file is imported: creates an empty database with the `vector`
 * extension — as the operator's `Database` resource does in the cluster — and points the
 * app's configuration at it through `config/custom-environment-variables.json`.
 *
 * Before the import is the point: the config library reads the environment once, when the
 * test file's imports first load it.
 */
const host = process.env.KNOWLEDGE_BASE_TEST_PG_HOST;

if (CommonUtils.notUndefined(host)) {
    const admin = new pg.Client({
        host,
        port: Number(process.env.KNOWLEDGE_BASE_TEST_PG_PORT),
        user: process.env.KNOWLEDGE_BASE_TEST_PG_USER,
        password: process.env.KNOWLEDGE_BASE_TEST_PG_PASSWORD,
        database: process.env.KNOWLEDGE_BASE_TEST_PG_DATABASE
    });
    const database = `kb_${randomUUID().replace(/-/g, '')}`;

    await admin.connect();
    await admin.query(`CREATE DATABASE ${database}`);
    await admin.end();

    const created = new pg.Client({
        host,
        port: Number(process.env.KNOWLEDGE_BASE_TEST_PG_PORT),
        user: process.env.KNOWLEDGE_BASE_TEST_PG_USER,
        password: process.env.KNOWLEDGE_BASE_TEST_PG_PASSWORD,
        database
    });

    await created.connect();
    await created.query('CREATE EXTENSION IF NOT EXISTS vector');
    await created.end();

    process.env.KNOWLEDGE_BASE_DATABASE_HOST = host;
    process.env.KNOWLEDGE_BASE_DATABASE_PORT = process.env.KNOWLEDGE_BASE_TEST_PG_PORT;
    process.env.KNOWLEDGE_BASE_DATABASE_NAME = database;
    process.env.KNOWLEDGE_BASE_DATABASE_USER = process.env.KNOWLEDGE_BASE_TEST_PG_USER;
    process.env.KNOWLEDGE_BASE_DATABASE_PASSWORD = process.env.KNOWLEDGE_BASE_TEST_PG_PASSWORD;
}
