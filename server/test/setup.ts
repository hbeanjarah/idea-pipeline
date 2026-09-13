import { sql } from 'kysely';
import { afterAll, beforeEach, inject } from 'vitest';

import { closeDb, db } from '#store/db';

process.env.DATABASE_URL = inject('databaseUrl');

// vi.resetModules() used to give each test a fresh store; a fresh module does
// not empty a database. Emptying it belongs here, where no test file can
// forget it.
beforeEach(async () => {
  await sql`TRUNCATE ideas, variations CASCADE`.execute(db());
});

afterAll(async () => {
  await closeDb();
});
