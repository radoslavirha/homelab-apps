import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * One pgvector Postgres for the whole run. Each test file gets a database of its own from
 * `setupDatabase.ts`, so files never see each other's rows.
 *
 * The connection goes to the workers through the environment — they are forked after this
 * runs and inherit it, the same way the Mongo testcontainer setup in this repo does it.
 */
export const PGVECTOR_IMAGE = 'pgvector/pgvector:pg18';

let container: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
    container = await new PostgreSqlContainer(PGVECTOR_IMAGE).start();

    process.env.KNOWLEDGE_BASE_TEST_PG_HOST = container.getHost();
    process.env.KNOWLEDGE_BASE_TEST_PG_PORT = String(container.getPort());
    process.env.KNOWLEDGE_BASE_TEST_PG_USER = container.getUsername();
    process.env.KNOWLEDGE_BASE_TEST_PG_PASSWORD = container.getPassword();
    process.env.KNOWLEDGE_BASE_TEST_PG_DATABASE = container.getDatabase();
}

export async function teardown(): Promise<void> {
    await container?.stop();
}
