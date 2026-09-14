import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { db } from '#store/db';
import * as sessions from '#store/sessions';
import { upsertUser } from '#store/users';

const aUser = () =>
  upsertUser(`sub-${crypto.randomUUID()}`, 'a@example.test');

describe('createSession', () => {
  it('hands back a token that resolves to its user', async () => {
    const user = await aUser();

    const token = await sessions.createSession(user.id, 'Chrome');

    expect(await sessions.resolveSession(token)).toBe(user.id);
  });

  it('never stores the token itself', async () => {
    const user = await aUser();

    const token = await sessions.createSession(user.id, null);

    const stored = await db()
      .selectFrom('sessions')
      .select('token_hash')
      .executeTakeFirstOrThrow();
    expect(stored.token_hash).not.toBe(token);
    expect(stored.token_hash).toHaveLength(64);
  });

  it('issues a different token every time', async () => {
    const user = await aUser();

    const first = await sessions.createSession(user.id, null);
    const second = await sessions.createSession(user.id, null);

    expect(first).not.toBe(second);
    // Two devices, two live sessions: that is the whole point.
    expect(await sessions.resolveSession(first)).toBe(user.id);
    expect(await sessions.resolveSession(second)).toBe(user.id);
  });
});

describe('resolveSession', () => {
  it('refuses an unknown token', async () => {
    expect(await sessions.resolveSession('nope')).toBeNull();
  });

  it('refuses a session past its absolute expiry', async () => {
    const user = await aUser();
    const token = await sessions.createSession(user.id, null);

    await sql`UPDATE sessions SET expires_at = now() - interval '1 second'`.execute(
      db(),
    );

    expect(await sessions.resolveSession(token)).toBeNull();
  });

  it('refuses a session left idle too long', async () => {
    const user = await aUser();
    const token = await sessions.createSession(user.id, null);

    await sql`UPDATE sessions SET last_seen_at = now() - interval '8 days'`.execute(
      db(),
    );

    expect(await sessions.resolveSession(token)).toBeNull();
  });

  it('pushes the idle deadline back on every use', async () => {
    const user = await aUser();
    const token = await sessions.createSession(user.id, null);

    await sql`UPDATE sessions SET last_seen_at = now() - interval '6 days'`.execute(
      db(),
    );
    await sessions.resolveSession(token);

    const { last_seen_at } = await db()
      .selectFrom('sessions')
      .select('last_seen_at')
      .executeTakeFirstOrThrow();
    expect(Date.now() - last_seen_at.getTime()).toBeLessThan(5000);
  });
});

describe('revokeSession', () => {
  it('kills the session immediately, and only that one', async () => {
    const user = await aUser();
    const kept = await sessions.createSession(user.id, null);
    const doomed = await sessions.createSession(user.id, null);

    expect(await sessions.revokeSession(doomed)).toBe(true);

    expect(await sessions.resolveSession(doomed)).toBeNull();
    expect(await sessions.resolveSession(kept)).toBe(user.id);
  });

  it('reports nothing to revoke on an unknown token', async () => {
    expect(await sessions.revokeSession('nope')).toBe(false);
  });
});
