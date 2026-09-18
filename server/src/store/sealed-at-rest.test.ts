import { sql } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '#store/db';
import * as store from '#store/ideas';
import * as labels from '#store/labels';
import { clearStages, createUserWithSession } from '#test/factories';

let userId: string;

beforeEach(async () => {
  ({ userId } = await createUserWithSession());
});

// Cleared where a test asserts on an exact list; the seeding has its own case
// below.
const blank = async (): Promise<void> => clearStages(userId);

// Raw SQL on purpose: going through the store would call toVariation, which
// decrypts. The whole point is to see what Postgres really holds.
const stored = async (ideaId: string): Promise<string[]> => {
  const result = await sql<{ text: string }>`
    SELECT text FROM variations WHERE idea_id = ${ideaId} ORDER BY position
  `.execute(db());

  return result.rows.map((row) => row.text);
};

// Same reason, other table: toLabel decrypts, so the store cannot be asked
// what the column contains.
const storedNames = async (owner: string): Promise<string[]> => {
  const result = await sql<{ name: string }>`
    SELECT name FROM labels WHERE user_id = ${owner} ORDER BY position
  `.execute(db());

  return result.rows.map((row) => row.name);
};

const MARKER = 'CONFIDENTIEL-marqueur-unique-42';

// The unit tests prove the sealing works; these prove it is wired to every way
// user-written text can reach the database — note content and stage names
// alike. One missed path would leave plaintext rows that no other test would
// notice.
describe('what the database holds of a note', () => {
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

describe('what the database holds of a stage name', () => {
  it('not the name a stage was created with', async () => {
    await blank();
    await labels.createLabel(userId, MARKER);

    const rows = await storedNames(userId);
    expect(rows[0]).toMatch(/^v1\./);
    expect(rows[0]).not.toContain(MARKER);
  });

  it('not the name a stage was renamed to', async () => {
    await blank();
    const label = await labels.createLabel(userId, 'Maturation');

    await labels.renameLabel(userId, label.id, MARKER);

    const rows = await storedNames(userId);
    expect(rows[0]).toMatch(/^v1\./);
    expect(rows[0]).not.toContain(MARKER);
  });

  it('not the names an account is born with', async () => {
    // Seeding is a write path of its own: it reaches the column without going
    // through createLabel.
    const rows = await storedNames(userId);

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.startsWith('v1.'))).toBe(true);
    expect(rows.join()).not.toContain('Maturation');
  });

  it('and gives them back intact', async () => {
    await blank();
    await labels.createLabel(userId, `${MARKER} — un`);
    await labels.createLabel(userId, `${MARKER} — deux`);

    expect(
      (await labels.listLabels(userId)).map((label) => label.name),
    ).toEqual([`${MARKER} — un`, `${MARKER} — deux`]);
  });

  it('nor the name in any other column of the row', async () => {
    // Fails the day a user-written column is added to this table without
    // being sealed.
    await blank();
    await labels.createLabel(userId, MARKER);

    const result = await sql<{ row: string }>`
      SELECT labels::text AS row FROM labels WHERE user_id = ${userId}
    `.execute(db());

    expect(result.rows[0]?.row).not.toContain(MARKER);
  });
});
