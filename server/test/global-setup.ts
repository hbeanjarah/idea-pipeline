import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import type { TestProject } from 'vitest/node';

import { migrate } from '#store/migrations';

declare module 'vitest' {
  interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer;

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgres:17').start();

  const pool = new Pool({
    connectionString: container.getConnectionUri(),
  });
  try {
    await migrate(pool);
  } finally {
    await pool.end();
  }

  project.provide('databaseUrl', container.getConnectionUri());
}

export async function teardown(): Promise<void> {
  await container.stop();
}
