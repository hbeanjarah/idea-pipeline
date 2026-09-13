import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { STATUSES } from '#domain/types';
import { db } from '#store/db';

describe('the status check constraint', () => {
  // STATUSES comes from docs/openapi.yaml, the constraint from the migration.
  // Neither can be derived from the other, so the duplication is real; this
  // test is what keeps it from drifting in silence.
  it('lists exactly the statuses of the contract', async () => {
    const result = await sql<{ definition: string }>`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'ideas_status_check'
    `.execute(db());

    const definition = result.rows[0]?.definition;
    expect(definition).toBeDefined();

    const declared = [...definition!.matchAll(/'([a-z]+)'/g)].map(
      (match) => match[1],
    );

    expect(declared).toHaveLength(STATUSES.length);
    expect(new Set(declared)).toEqual(new Set(STATUSES));
  });
});
