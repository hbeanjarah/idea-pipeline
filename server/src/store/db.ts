import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import { databaseUrl } from '#config/env';
import type { DB } from '#store/schema.generated';

let instance: Kysely<DB> | undefined;

// Built on first use, not at import time: the connection string is only known
// once the test container has started, and the pool would otherwise be created
// against an address that does not exist yet.
export function db(): Kysely<DB> {
  instance ??= new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl() }),
    }),
  });

  return instance;
}

export async function closeDb(): Promise<void> {
  await instance?.destroy();
  instance = undefined;
}
