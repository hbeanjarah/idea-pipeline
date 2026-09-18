import { sql } from 'kysely';

import { db } from '#store/db';
import { seedDefaultLabels } from '#store/labels';

export interface StoredUser {
  id: string;
  email: string;
}

export async function upsertUser(
  googleSub: string,
  email: string,
): Promise<StoredUser> {
  return db()
    .transaction()
    .execute(async (trx) => {
      // Google is the authority on the address: a user who renames it must find
      // the same account, which is why the conflict target is the sub and not
      // the email.
      const row = await trx
        .insertInto('users')
        .values({ google_sub: googleSub, email })
        .onConflict((conflict) =>
          conflict.column('google_sub').doUpdateSet({ email }),
        )
        // xmax is 0 on a row that was really inserted, and carries a
        // transaction id on one that was updated. An upsert has no other way
        // to say which of the two it just did.
        .returning([
          'id',
          'email',
          sql<boolean>`xmax = 0`.as('created'),
        ])
        .executeTakeFirstOrThrow();

      // Seeding on `created`, never on "this account has no stage": zero stages
      // is a legal state, and someone who deleted them all must not find them
      // back on the next sign-in.
      if (row.created) await seedDefaultLabels(row.id, trx);

      return { id: row.id, email: row.email };
    });
}

export async function findUser(
  id: string,
): Promise<StoredUser | null> {
  const row = await db()
    .selectFrom('users')
    .select(['id', 'email'])
    .where('id', '=', id)
    .executeTakeFirst();

  return row ?? null;
}
