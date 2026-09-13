import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pool } from 'pg';

// Same depth from src/store/ as from dist/store/, so this resolves to
// server/migrations in development and in a built server alike.
const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);

export async function migrate(pool: Pool): Promise<string[]> {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations',
    );
    const applied = new Set(rows.map((row) => row.name));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const ran: string[] = [];

    for (const file of files) {
      if (applied.has(file)) continue;

      const statements = await readFile(
        join(MIGRATIONS_DIR, file),
        'utf8',
      );

      await client.query('BEGIN');
      try {
        // Passing no parameters keeps pg on the simple protocol, the only one
        // that accepts several statements in a single call.
        await client.query(statements);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      ran.push(file);
    }

    return ran;
  } finally {
    client.release();
  }
}
