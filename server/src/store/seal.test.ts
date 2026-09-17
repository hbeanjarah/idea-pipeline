import { sql } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '#store/db';
import * as store from '#store/ideas';
import { sealExisting } from '#store/seal';
import { createUserWithSession } from '#test/factories';

let userId: string;

beforeEach(async () => {
  ({ userId } = await createUserWithSession());
});

// The store seals on the way in, so a row from before this brick has to be put
// back by hand.
const writePlaintext = async (
  ideaId: string,
  text: string,
): Promise<void> => {
  await sql`UPDATE variations SET text = ${text} WHERE idea_id = ${ideaId}`.execute(
    db(),
  );
};

const rawText = async (ideaId: string): Promise<string> => {
  const result = await sql<{ text: string }>`
    SELECT text FROM variations WHERE idea_id = ${ideaId}
  `.execute(db());

  return result.rows[0]!.text;
};

describe('sealing what was written before the brick', () => {
  it('converts a row still in clear', async () => {
    const idea = await store.createIdea(userId, 'peu importe');
    await writePlaintext(idea.id, 'Une idée d’avant');

    expect(await sealExisting()).toEqual({ sealed: 1, already: 0 });
    expect(await rawText(idea.id)).toMatch(/^v1\./);
  });

  it('leaves the text readable through the store', async () => {
    const idea = await store.createIdea(userId, 'peu importe');
    await writePlaintext(idea.id, 'Une idée d’avant');

    await sealExisting();

    const [reread] = await store.listIdeas(userId);
    expect(reread!.variations[0]!.text).toBe('Une idée d’avant');
  });

  it('does nothing on a second pass', async () => {
    const idea = await store.createIdea(userId, 'peu importe');
    await writePlaintext(idea.id, 'Une idée d’avant');

    await sealExisting();
    const second = await sealExisting();

    expect(second).toEqual({ sealed: 0, already: 1 });
  });

  it('counts rows the store had already sealed', async () => {
    await store.createIdea(userId, 'écrite après la bascule');

    expect(await sealExisting()).toEqual({ sealed: 0, already: 1 });
  });

  // The reason the decision is not a prefix test: this note is plaintext and
  // looks sealed. Guessing wrong on it would encrypt an already-sealed row a
  // second time, which no later pass could undo.
  it('stops rather than guess on a note that merely looks sealed', async () => {
    const idea = await store.createIdea(userId, 'peu importe');
    await writePlaintext(idea.id, 'v1. première version de l’API');

    await expect(sealExisting()).rejects.toThrow('will not open');
    expect(await rawText(idea.id)).toBe(
      'v1. première version de l’API',
    );
  });
});
