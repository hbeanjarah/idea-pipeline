import { sql } from 'kysely';
import type { Selectable } from 'kysely';

import type { Idea, Status, Variation } from '#domain/types';
import { db } from '#store/db';
import type { DB } from '#store/schema.generated';

type IdeaRow = Selectable<DB['ideas']>;
type VariationRow = Selectable<DB['variations']>;

// Postgres raises on a malformed uuid instead of returning no row, so an
// unknown id would surface as a 500 where the contract owes a 404.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const touch = () => sql<Date>`now()`;

const toVariation = (row: VariationRow): Variation => ({
  id: row.id,
  text: row.text,
  createdAt: row.created_at.toISOString(),
});

// status is `text` + CHECK, so the generated type is a plain string; the cast
// is kept honest by status-constraint.test.ts.
const toIdea = (row: IdeaRow, variations: VariationRow[]): Idea => ({
  id: row.id,
  status: row.status as Status,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  variations: variations.map(toVariation),
});

async function readVariations(
  ideaId: string,
): Promise<VariationRow[]> {
  return db()
    .selectFrom('variations')
    .selectAll()
    .where('idea_id', '=', ideaId)
    .orderBy('position')
    .execute();
}

export async function listIdeas(): Promise<Idea[]> {
  const rows = await db()
    .selectFrom('ideas')
    .selectAll()
    .orderBy('updated_at', 'desc')
    .orderBy('id', 'desc')
    .execute();

  if (rows.length === 0) return [];

  // Two queries rather than one with jsonb_agg: aggregating renders timestamptz
  // the way Postgres prints it, while the driver hands back a Date the
  // contract's strict ISO 8601 can be built from.
  const variations = await db()
    .selectFrom('variations')
    .selectAll()
    .where(
      'idea_id',
      'in',
      rows.map((row) => row.id),
    )
    .orderBy('position')
    .execute();

  const grouped = new Map<string, VariationRow[]>();
  for (const variation of variations) {
    const bucket = grouped.get(variation.idea_id) ?? [];
    bucket.push(variation);
    grouped.set(variation.idea_id, bucket);
  }

  return rows.map((row) => toIdea(row, grouped.get(row.id) ?? []));
}

export async function createIdea(text: string): Promise<Idea> {
  return db()
    .transaction()
    .execute(async (trx) => {
      const idea = await trx
        .insertInto('ideas')
        .defaultValues()
        .returningAll()
        .executeTakeFirstOrThrow();

      const variation = await trx
        .insertInto('variations')
        .values({ idea_id: idea.id, position: 1, text })
        .returningAll()
        .executeTakeFirstOrThrow();

      return toIdea(idea, [variation]);
    });
}

export async function deleteIdea(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;

  const result = await db()
    .deleteFrom('ideas')
    .where('id', '=', id)
    .executeTakeFirst();

  return result.numDeletedRows > 0n;
}

export async function changeStatus(
  id: string,
  status: Status,
): Promise<Idea | null> {
  if (!UUID.test(id)) return null;

  const idea = await db()
    .updateTable('ideas')
    .set({ status, updated_at: touch() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!idea) return null;

  return toIdea(idea, await readVariations(id));
}

export async function addVariation(
  id: string,
  text: string,
): Promise<Idea | null> {
  if (!UUID.test(id)) return null;

  return db()
    .transaction()
    .execute(async (trx) => {
      const exists = await trx
        .selectFrom('ideas')
        .select('id')
        .where('id', '=', id)
        .executeTakeFirst();

      if (!exists) return null;

      await trx
        .insertInto('variations')
        .values({
          idea_id: id,
          text,
          // Computing the position in SQL keeps it inside the transaction; the
          // unique index on (idea_id, position) turns a concurrent insert into
          // an error rather than a silent reorder.
          position: sql<number>`(SELECT COALESCE(MAX(position), 0) + 1 FROM variations WHERE idea_id = ${id})`,
        })
        .execute();

      const idea = await trx
        .updateTable('ideas')
        .set({ updated_at: touch() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

      const variations = await trx
        .selectFrom('variations')
        .selectAll()
        .where('idea_id', '=', id)
        .orderBy('position')
        .execute();

      return toIdea(idea, variations);
    });
}

// A plain null cannot say which of the two lookups failed, and the API owes a
// different message for each.
export type EditVariationFailure =
  | 'idea-not-found'
  | 'variation-not-found';

export async function editVariation(
  id: string,
  variationId: string,
  text: string,
): Promise<Idea | EditVariationFailure> {
  if (!UUID.test(id)) return 'idea-not-found';
  if (!UUID.test(variationId)) return 'variation-not-found';

  return db()
    .transaction()
    .execute(async (trx) => {
      const exists = await trx
        .selectFrom('ideas')
        .select('id')
        .where('id', '=', id)
        .executeTakeFirst();

      if (!exists) return 'idea-not-found';

      const edited = await trx
        .updateTable('variations')
        .set({ text })
        .where('id', '=', variationId)
        .where('idea_id', '=', id)
        .returning('id')
        .executeTakeFirst();

      if (!edited) return 'variation-not-found';

      const idea = await trx
        .updateTable('ideas')
        .set({ updated_at: touch() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

      const variations = await trx
        .selectFrom('variations')
        .selectAll()
        .where('idea_id', '=', id)
        .orderBy('position')
        .execute();

      return toIdea(idea, variations);
    });
}
