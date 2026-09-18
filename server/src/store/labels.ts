import type { Kysely, Selectable } from 'kysely';

import type { Label } from '#domain/types';
import { db } from '#store/db';
import { open, seal } from '#store/notes';
import type { DB } from '#store/schema.generated';
import { isUuid } from '#store/uuid';

type LabelRow = Selectable<DB['labels']>;

const PALETTE = 8;

const toLabel = (row: LabelRow): Label => ({
  id: row.id,
  name: open(row.name, row.user_id),
  color: row.color,
  position: row.position,
});

// Counting the labels and taking the next number gets it wrong as soon as one
// is deleted: 1-2-3-4, drop the 2nd, create, and the new one takes 4 while 2
// sits unused.
function nextColor(used: number[]): number {
  for (let color = 1; color <= PALETTE; color += 1) {
    if (!used.includes(color)) return color;
  }

  return (used.length % PALETTE) + 1;
}

export const DEFAULT_LABELS = [
  'Capturé',
  'Maturation',
  'Prêt',
  'Publié',
] as const;

// Takes the executor so the account's creation can seed inside its own
// transaction: an account must never exist without its stages.
export async function seedDefaultLabels(
  userId: string,
  executor: Kysely<DB> = db(),
): Promise<Label[]> {
  const rows = await executor
    .insertInto('labels')
    .values(
      DEFAULT_LABELS.map((name, index) => ({
        user_id: userId,
        name: seal(name, userId),
        color: index + 1,
        position: index + 1,
      })),
    )
    .returningAll()
    .execute();

  return rows.map(toLabel);
}

export async function listLabels(userId: string): Promise<Label[]> {
  const rows = await db()
    .selectFrom('labels')
    .selectAll()
    .where('user_id', '=', userId)
    // position is not unique, so without this tiebreak the order of two
    // stages sharing one is whatever Postgres feels like.
    .orderBy('position')
    .orderBy('id')
    .execute();

  return rows.map(toLabel);
}

// Cheaper than listLabels for the one thing setIdeaLabel needs: existence.
// Going through listLabels would decrypt every name to answer a yes or no.
export async function labelExists(
  userId: string,
  id: string,
): Promise<boolean> {
  if (!isUuid(id)) return false;

  const row = await db()
    .selectFrom('labels')
    .select('id')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return row !== undefined;
}

export async function createLabel(
  userId: string,
  name: string,
): Promise<Label> {
  // Not selectAll(): toLabel would decrypt every name to pick a colour.
  const existing = await db()
    .selectFrom('labels')
    .select(['color', 'position'])
    .where('user_id', '=', userId)
    .execute();

  const row = await db()
    .insertInto('labels')
    .values({
      user_id: userId,
      name: seal(name, userId),
      color: nextColor(existing.map((label) => label.color)),
      // Past the highest, not past the count: after a deletion the count
      // lands on a position that is already taken.
      position:
        existing.reduce(
          (highest, label) => Math.max(highest, label.position),
          0,
        ) + 1,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toLabel(row);
}

export async function renameLabel(
  userId: string,
  id: string,
  name: string,
): Promise<Label | null> {
  if (!isUuid(id)) return null;

  const row = await db()
    .updateTable('labels')
    .set({ name: seal(name, userId) })
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();

  return row ? toLabel(row) : null;
}

export async function deleteLabel(
  userId: string,
  id: string,
): Promise<boolean> {
  if (!isUuid(id)) return false;

  const result = await db()
    .deleteFrom('labels')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return result.numDeletedRows > 0n;
}

export async function reorderLabels(
  userId: string,
  ids: string[],
): Promise<Label[]> {
  await db()
    .transaction()
    .execute(async (trx) => {
      for (const [index, id] of ids.entries()) {
        // user_id on every statement: an id from another account writes
        // nothing rather than renumbering a stranger's list.
        await trx
          .updateTable('labels')
          .set({ position: index + 1 })
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .execute();
      }
    });

  return listLabels(userId);
}
