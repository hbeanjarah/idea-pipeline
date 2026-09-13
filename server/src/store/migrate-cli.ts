import { Pool } from 'pg';

import { databaseUrl } from '#config/env';
import { migrate } from '#store/migrations';

const pool = new Pool({ connectionString: databaseUrl() });

try {
  const applied = await migrate(pool);
  console.log(
    applied.length === 0
      ? 'No migration to apply.'
      : `Applied: ${applied.join(', ')}`,
  );
} finally {
  await pool.end();
}
