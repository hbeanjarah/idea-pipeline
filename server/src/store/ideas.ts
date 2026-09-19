import { sql } from 'kysely';
import type { Kysely, Selectable } from 'kysely';

import type { Idea, Variation } from '#domain/types';
import { db } from '#store/db';
import { open, seal } from '#store/notes';
import type { DB } from '#store/schema.generated';
import { isUuid } from '#store/uuid';

type IdeaRow = Selectable<DB['ideas']>;
type VariationRow = Selectable<DB['variations']>;

const touch = () => sql<Date>`now()`;

const toVariation = (row: VariationRow): Variation => ({
  id: row.id,
  text: open(row.text, row.idea_id),
  createdAt: row.created_at.toISOString(),
});

const toIdea = (
  row: IdeaRow,
  variations: VariationRow[],
  labelId: string | null,
): Idea => ({
  id: row.id,
  labelId,
  title: row.title === null ? null : open(row.title, row.id),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  variations: variations.map(toVariation),
});

// Takes the executor so a transaction can ask without leaving it: reading
// through db() would not see its own uncommitted writes.
const labelOf = async (
  executor: Kysely<DB>,
  ideaId: string,
): Promise<string | null> => {
  const row = await executor
    .selectFrom('idea_labels')
    .select('label_id')
    .where('idea_id', '=', ideaId)
    .executeTakeFirst();

  return row?.label_id ?? null;
};

// The tail every write shares: the variations are reread through the executor
// and not through db(), which would not see the transaction's own uncommitted
// rows — the same reason labelOf takes it.
const reload = async (
  executor: Kysely<DB>,
  row: IdeaRow,
): Promise<Idea> => {
  const variations = await executor
    .selectFrom('variations')
    .selectAll()
    .where('idea_id', '=', row.id)
    .orderBy('position')
    .execute();

  return toIdea(row, variations, await labelOf(executor, row.id));
};

export async function listIdeas(userId: string): Promise<Idea[]> {
  const rows = await db()
    .selectFrom('ideas')
    .selectAll()
    .where('user_id', '=', userId)
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

  const links = await db()
    .selectFrom('idea_labels')
    .selectAll()
    .where(
      'idea_id',
      'in',
      rows.map((row) => row.id),
    )
    .execute();

  const labelOfIdea = new Map(
    links.map((link) => [link.idea_id, link.label_id]),
  );

  const grouped = new Map<string, VariationRow[]>();
  for (const variation of variations) {
    const bucket = grouped.get(variation.idea_id) ?? [];
    bucket.push(variation);
    grouped.set(variation.idea_id, bucket);
  }

  return rows.map((row) =>
    toIdea(
      row,
      grouped.get(row.id) ?? [],
      labelOfIdea.get(row.id) ?? null,
    ),
  );
}

export async function createIdea(
  userId: string,
  text: string,
): Promise<Idea> {
  return db()
    .transaction()
    .execute(async (trx) => {
      const idea = await trx
        .insertInto('ideas')
        .values({ user_id: userId })
        .returningAll()
        .executeTakeFirstOrThrow();

      const variation = await trx
        .insertInto('variations')
        .values({
          idea_id: idea.id,
          position: 1,
          text: seal(text, idea.id),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return toIdea(idea, [variation], null);
    });
}

export async function deleteIdea(
  userId: string,
  id: string,
): Promise<boolean> {
  if (!isUuid(id)) return false;

  const result = await db()
    .deleteFrom('ideas')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return result.numDeletedRows > 0n;
}

export async function setLabel(
  userId: string,
  id: string,
  labelId: string | null,
): Promise<Idea | null> {
  if (!isUuid(id)) return null;

  return db()
    .transaction()
    .execute(async (trx) => {
      const idea = await trx
        .updateTable('ideas')
        .set({ updated_at: touch() })
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirst();

      if (!idea) return null;

      // Delete then insert, never an upsert: idea_labels_one_per_idea would
      // refuse a second row, and naming the constraint in an onConflict ties
      // this query to it.
      await trx
        .deleteFrom('idea_labels')
        .where('idea_id', '=', id)
        .execute();

      if (labelId !== null) {
        await trx
          .insertInto('idea_labels')
          .values({ idea_id: id, label_id: labelId })
          .execute();
      }

      return reload(trx, idea);
    });
}

export async function setTitle(
  userId: string,
  id: string,
  title: string | null,
): Promise<Idea | null> {
  if (!isUuid(id)) return null;

  return db()
    .transaction()
    .execute(async (trx) => {
      const idea = await trx
        .updateTable('ideas')
        .set({
          title: title === null ? null : seal(title, id),
          updated_at: touch(),
        })
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirst();

      if (!idea) return null;

      return reload(trx, idea);
    });
}

export async function addVariation(
  userId: string,
  id: string,
  text: string,
): Promise<Idea | null> {
  if (!isUuid(id)) return null;

  return db()
    .transaction()
    .execute(async (trx) => {
      const owned = await trx
        .selectFrom('ideas')
        .select('id')
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!owned) return null;

      await trx
        .insertInto('variations')
        .values({
          idea_id: id,
          text: seal(text, id),
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
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return reload(trx, idea);
    });
}

// A plain null cannot say which of the two lookups failed, and the API owes a
// different message for each.
export type EditVariationFailure =
  | 'idea-not-found'
  | 'variation-not-found';

export async function editVariation(
  userId: string,
  id: string,
  variationId: string,
  text: string,
): Promise<Idea | EditVariationFailure> {
  if (!isUuid(id)) return 'idea-not-found';
  if (!isUuid(variationId)) return 'variation-not-found';

  return db()
    .transaction()
    .execute(async (trx) => {
      const owned = await trx
        .selectFrom('ideas')
        .select('id')
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!owned) return 'idea-not-found';

      const edited = await trx
        .updateTable('variations')
        .set({ text: seal(text, id) })
        .where('id', '=', variationId)
        .where('idea_id', '=', id)
        .returning('id')
        .executeTakeFirst();

      if (!edited) return 'variation-not-found';

      const idea = await trx
        .updateTable('ideas')
        .set({ updated_at: touch() })
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return reload(trx, idea);
    });
}
