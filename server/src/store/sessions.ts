import { createHash, randomBytes } from 'node:crypto';

import { sql } from 'kysely';

import { db } from '#store/db';

const ABSOLUTE_DAYS = 30;
const IDLE_DAYS = 7;

// The token carries 256 bits of entropy, so a fast hash is enough: slow hashing
// exists to protect low-entropy secrets a human chose, not random bytes.
const fingerprint = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export async function createSession(
  userId: string,
  userAgent: string | null,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');

  await db()
    .insertInto('sessions')
    .values({
      user_id: userId,
      token_hash: fingerprint(token),
      user_agent: userAgent,
      expires_at: sql<Date>`now() + make_interval(days => ${ABSOLUTE_DAYS})`,
    })
    .execute();

  // The only moment the plain token exists. It is never stored, never logged.
  return token;
}

export async function resolveSession(
  token: string,
): Promise<string | null> {
  // Validating and refreshing in one statement: the WHERE clause reads the row
  // as it was, so the idle check is not defeated by the update it guards.
  const result = await sql<{ user_id: string }>`
    UPDATE sessions
       SET last_seen_at = now()
     WHERE token_hash = ${fingerprint(token)}
       AND expires_at > now()
       AND last_seen_at > now() - make_interval(days => ${IDLE_DAYS})
    RETURNING user_id
  `.execute(db());

  return result.rows[0]?.user_id ?? null;
}

export async function revokeSession(token: string): Promise<boolean> {
  const result = await db()
    .deleteFrom('sessions')
    .where('token_hash', '=', fingerprint(token))
    .executeTakeFirst();

  return result.numDeletedRows > 0n;
}
