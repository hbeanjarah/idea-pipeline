import { sql } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '#store/db';
import * as store from '#store/ideas';
import { createUserWithSession } from '#test/factories';

let userId: string;

beforeEach(async () => {
  ({ userId } = await createUserWithSession());
});

// Raw SQL on purpose: going through the store would call toVariation, which
// decrypts. The whole point is to see what Postgres really holds.
const stored = async (ideaId: string): Promise<string[]> => {
  const result = await sql<{ text: string }>`
    SELECT text FROM variations WHERE idea_id = ${ideaId} ORDER BY position
  `.execute(db());

  return result.rows.map((row) => row.text);
};

const MARKER = 'CONFIDENTIEL-marqueur-unique-42';

// The unit tests prove the sealing works; these prove it is wired to every way
// a note can reach the database. One missed path would leave plaintext rows
// that no other test would notice.
describe('what the database actually holds', () => {
  it('not the text a capture was made of', async () => {
    const idea = await store.createIdea(userId, MARKER);

    const rows = await stored(idea.id);
    expect(rows[0]).toMatch(/^v1\./);
    expect(rows[0]).not.toContain(MARKER);
  });

  it('not the text of a later variation', async () => {
    const idea = await store.createIdea(userId, 'premier jet');

    await store.addVariation(userId, idea.id, MARKER);

    const rows = await stored(idea.id);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatch(/^v1\./);
    expect(rows[1]).not.toContain(MARKER);
  });

  it('not the text of a correction', async () => {
    const idea = await store.createIdea(userId, 'faute de frappe');

    await store.editVariation(
      userId,
      idea.id,
      idea.variations[0]!.id,
      MARKER,
    );

    const rows = await stored(idea.id);
    expect(rows[0]).toMatch(/^v1\./);
    expect(rows[0]).not.toContain(MARKER);
  });

  it('and gives every one of them back intact', async () => {
    const idea = await store.createIdea(userId, `${MARKER} — un`);
    await store.addVariation(userId, idea.id, `${MARKER} — deux`);

    const [reread] = await store.listIdeas(userId);
    expect(reread!.variations.map((v) => v.text)).toEqual([
      `${MARKER} — un`,
      `${MARKER} — deux`,
    ]);
  });
});
