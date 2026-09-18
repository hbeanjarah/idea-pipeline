import { sql } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';

import { adoptLabels } from '#store/adopt-labels';
import { db } from '#store/db';
import * as ideas from '#store/ideas';
import * as labels from '#store/labels';
import { clearStages, createUserWithSession } from '#test/factories';

let userId: string;

// An account is born with its stages, which is exactly what the script skips.
// These tests start from the state of an account written before this brick.
beforeEach(async () => {
  ({ userId } = await createUserWithSession());
  await clearStages(userId);
});

const asStatus = async (
  ideaId: string,
  status: string,
): Promise<void> => {
  await sql`UPDATE ideas SET status = ${status} WHERE id = ${ideaId}`.execute(
    db(),
  );
};

const stageOf = async (ideaId: string): Promise<string | null> => {
  const row = await db()
    .selectFrom('idea_labels')
    .select('label_id')
    .where('idea_id', '=', ideaId)
    .executeTakeFirst();

  return row?.label_id ?? null;
};

const names = async (id = userId): Promise<string[]> =>
  (await labels.listLabels(id)).map((label) => label.name);

describe('adoptLabels', () => {
  it('gives an account the four stages, in order', async () => {
    expect(await adoptLabels()).toMatchObject({ seeded: 1 });

    expect(await names()).toEqual([
      'Capturé',
      'Maturation',
      'Prêt',
      'Publié',
    ]);
  });

  it('links each idea to the stage its status named', async () => {
    const captured = await ideas.createIdea(userId, 'une');
    const ready = await ideas.createIdea(userId, 'deux');
    await asStatus(ready.id, 'ready');

    expect(await adoptLabels()).toMatchObject({ linked: 2 });

    const stages = await labels.listLabels(userId);
    expect(await stageOf(captured.id)).toBe(stages[0]!.id);
    expect(await stageOf(ready.id)).toBe(stages[2]!.id);
  });

  it('leaves an account that already has stages untouched', async () => {
    await labels.createLabel(userId, 'La mienne');
    const idea = await ideas.createIdea(userId, 'une');

    expect(await adoptLabels()).toMatchObject({
      seeded: 0,
      skipped: 1,
      linked: 0,
    });

    expect(await names()).toEqual(['La mienne']);
    expect(await stageOf(idea.id)).toBeNull();
  });

  it('does nothing the second time it runs', async () => {
    await ideas.createIdea(userId, 'une');
    await adoptLabels();

    expect(await adoptLabels()).toMatchObject({
      seeded: 0,
      skipped: 1,
      linked: 0,
    });
  });

  it('gives each account its own stages, with no crossing', async () => {
    const other = await createUserWithSession('autre@example.test');
    await clearStages(other.userId);
    const mine = await ideas.createIdea(userId, 'la mienne');
    const theirs = await ideas.createIdea(other.userId, 'la leur');

    await adoptLabels();

    const myStages = await labels.listLabels(userId);
    const theirStages = await labels.listLabels(other.userId);

    expect(myStages.map((s) => s.id)).not.toEqual(
      theirStages.map((s) => s.id),
    );
    expect(await stageOf(mine.id)).toBe(myStages[0]!.id);
    expect(await stageOf(theirs.id)).toBe(theirStages[0]!.id);
  });

  it('handles an account with no idea at all', async () => {
    expect(await adoptLabels()).toMatchObject({
      seeded: 1,
      linked: 0,
    });
    expect(await names()).toHaveLength(4);
  });

  it('seals the names it writes', async () => {
    await adoptLabels();

    const { rows } = await sql<{ name: string }>`
      SELECT name FROM labels WHERE user_id = ${userId}
    `.execute(db());

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.name.startsWith('v1.'))).toBe(
      true,
    );
    expect(rows.map((row) => row.name).join()).not.toContain(
      'Maturation',
    );
  });
});
