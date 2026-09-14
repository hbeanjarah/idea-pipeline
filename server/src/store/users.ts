import { db } from '#store/db';

export interface StoredUser {
  id: string;
  email: string;
}

export async function upsertUser(
  googleSub: string,
  email: string,
): Promise<StoredUser> {
  // Google is the authority on the address: a user who renames it must find the
  // same account, which is why the conflict target is the sub and not the email.
  const row = await db()
    .insertInto('users')
    .values({ google_sub: googleSub, email })
    .onConflict((conflict) =>
      conflict.column('google_sub').doUpdateSet({ email }),
    )
    .returning(['id', 'email'])
    .executeTakeFirstOrThrow();

  return row;
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
