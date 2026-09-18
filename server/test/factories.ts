import { db } from '#store/db';
import { createSession } from '#store/sessions';
import { upsertUser } from '#store/users';

export async function createUserWithSession(
  email = 'moi@example.test',
): Promise<{ userId: string; token: string }> {
  const user = await upsertUser(`sub-${crypto.randomUUID()}`, email);
  const token = await createSession(user.id, 'vitest');

  return { userId: user.id, token };
}

// A real account is born with its four stages (store/users.ts). Tests that
// assert on numbering from one want the state an account reaches by deleting
// them all — a legal state, and the only way to read those assertions without
// arithmetic.
export async function clearStages(userId: string): Promise<void> {
  await db()
    .deleteFrom('labels')
    .where('user_id', '=', userId)
    .execute();
}

// Every call to createUserWithSession makes a new account, so a second device
// of the SAME account has to be asked for explicitly.
export async function addDevice(userId: string): Promise<string> {
  return createSession(userId, 'vitest');
}
