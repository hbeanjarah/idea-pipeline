import { createSession } from '#store/sessions';
import { upsertUser } from '#store/users';

export async function createUserWithSession(
  email = 'moi@example.test',
): Promise<{ userId: string; token: string }> {
  const user = await upsertUser(`sub-${crypto.randomUUID()}`, email);
  const token = await createSession(user.id, 'vitest');

  return { userId: user.id, token };
}

// Every call to createUserWithSession makes a new account, so a second device
// of the SAME account has to be asked for explicitly.
export async function addDevice(userId: string): Promise<string> {
  return createSession(userId, 'vitest');
}
