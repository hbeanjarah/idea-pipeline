import { sql } from 'kysely';
import { afterAll, beforeEach, inject } from 'vitest';

import { closeDb, db } from '#store/db';

process.env.DATABASE_URL = inject('databaseUrl');

// Not a secret, and it says so once decoded: the tests need a key of the right
// shape, not a strong one.
process.env.NOTE_KEY_V1 =
  'dGVzdC1rZXktbm90LWEtc2VjcmV0LTAxMjM0NTY3ODk=';

// vi.resetModules() used to give each test a fresh store; a fresh module does
// not empty a database. Emptying it belongs here, where no test file can
// forget it.
beforeEach(async () => {
  await sql`TRUNCATE users, sessions, ideas, variations CASCADE`.execute(
    db(),
  );
});

afterAll(async () => {
  await closeDb();
});
