import { describe, expect, it } from 'vitest';

import { clearStages } from '#test/factories';
import * as labels from '#store/labels';
import { upsertUser } from '#store/users';

const sub = () => `sub-${crypto.randomUUID()}`;

const stageNames = async (userId: string): Promise<string[]> =>
  (await labels.listLabels(userId)).map((label) => label.name);

describe('an account and its stages', () => {
  it('is born with the four historical ones, in order', async () => {
    const user = await upsertUser(sub(), 'moi@example.test');

    expect(await stageNames(user.id)).toEqual([
      'Capturé',
      'Maturation',
      'Prêt',
      'Publié',
    ]);
  });

  it('seeds them once, not on every sign-in', async () => {
    const google = sub();
    const first = await upsertUser(google, 'moi@example.test');
    await upsertUser(google, 'moi@example.test');

    expect(await stageNames(first.id)).toHaveLength(4);
  });

  it('does not bring them back once deleted', async () => {
    const google = sub();
    const user = await upsertUser(google, 'moi@example.test');
    await clearStages(user.id);

    await upsertUser(google, 'moi@example.test');

    // Zero stages is a legal state. Seeding on "this account has none" instead
    // of "this account was just created" would undo the user's choice at every
    // sign-in.
    expect(await stageNames(user.id)).toEqual([]);
  });

  it('keeps them when Google reports a new address', async () => {
    const google = sub();
    const user = await upsertUser(google, 'avant@example.test');
    await labels.renameLabel(
      user.id,
      (await labels.listLabels(user.id))[0]!.id,
      'À explorer',
    );

    const again = await upsertUser(google, 'apres@example.test');

    expect(again.id).toBe(user.id);
    expect(again.email).toBe('apres@example.test');
    expect(await stageNames(user.id)).toEqual([
      'À explorer',
      'Maturation',
      'Prêt',
      'Publié',
    ]);
  });

  it('gives each account its own, with no crossing', async () => {
    const mine = await upsertUser(sub(), 'moi@example.test');
    const theirs = await upsertUser(sub(), 'autre@example.test');

    await clearStages(theirs.id);

    expect(await stageNames(mine.id)).toHaveLength(4);
    expect(await stageNames(theirs.id)).toEqual([]);
  });
});
