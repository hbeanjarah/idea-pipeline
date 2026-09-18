import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '#store/db';
import * as ideas from '#store/ideas';
import * as store from '#store/labels';
import { clearStages, createUserWithSession } from '#test/factories';

// Every operation is scoped to an account, so the tests need one to exist.
let userId: string;

beforeEach(async () => {
  ({ userId } = await createUserWithSession());
  await clearStages(userId);
});

const anotherAccount = async () => {
  const other = await createUserWithSession('autre@example.test');
  await clearStages(other.userId);

  return other;
};

const names = async (id = userId): Promise<string[]> =>
  (await store.listLabels(id)).map((label) => label.name);

const link = async (
  ideaId: string,
  labelId: string,
): Promise<void> => {
  await db()
    .insertInto('idea_labels')
    .values({ idea_id: ideaId, label_id: labelId })
    .execute();
};

describe('listLabels', () => {
  it('starts empty', async () => {
    expect(await store.listLabels(userId)).toEqual([]);
  });

  it('returns names in clear, though the column holds them sealed', async () => {
    await store.createLabel(userId, 'Maturation');

    expect(await names()).toEqual(['Maturation']);
  });

  it("never returns another account's", async () => {
    const other = await anotherAccount();
    await store.createLabel(other.userId, 'Chez lui');

    expect(await store.listLabels(userId)).toEqual([]);
  });
});

describe('createLabel', () => {
  it('numbers positions and colours from one, in order', async () => {
    await store.createLabel(userId, 'Capturé');
    await store.createLabel(userId, 'Maturation');
    await store.createLabel(userId, 'Prêt');

    expect(await store.listLabels(userId)).toMatchObject([
      { name: 'Capturé', color: 1, position: 1 },
      { name: 'Maturation', color: 2, position: 2 },
      { name: 'Prêt', color: 3, position: 3 },
    ]);
  });

  it('reuses the colour a deletion freed rather than the next number', async () => {
    await store.createLabel(userId, 'Un');
    const second = await store.createLabel(userId, 'Deux');
    await store.createLabel(userId, 'Trois');
    await store.deleteLabel(userId, second.id);

    // Counting and taking the next one would answer 3, which is taken.
    expect((await store.createLabel(userId, 'Quatre')).color).toBe(2);
  });

  it('places past the highest position, not past the count', async () => {
    await store.createLabel(userId, 'Un');
    const second = await store.createLabel(userId, 'Deux');
    const third = await store.createLabel(userId, 'Trois');
    await store.deleteLabel(userId, second.id);

    const created = await store.createLabel(userId, 'Quatre');

    // Two labels remain, so a count-based position would collide with `third`.
    expect(created.position).toBeGreaterThan(third.position);
    expect(await names()).toEqual(['Un', 'Trois', 'Quatre']);
  });

  it('wraps the palette past eight instead of giving up', async () => {
    for (let n = 1; n <= 8; n += 1) {
      await store.createLabel(userId, `Étape ${n}`);
    }

    expect((await store.createLabel(userId, 'Neuvième')).color).toBe(
      1,
    );
  });

  it('keeps two stages of the same name apart — the store does not judge', async () => {
    await store.createLabel(userId, 'Prêt');
    await store.createLabel(userId, 'Prêt');

    expect(await names()).toEqual(['Prêt', 'Prêt']);
  });
});

describe('renameLabel', () => {
  it('changes the name and nothing else', async () => {
    const label = await store.createLabel(userId, 'Maturation');

    const renamed = await store.renameLabel(
      userId,
      label.id,
      'À explorer',
    );

    expect(renamed).toEqual({
      ...label,
      name: 'À explorer',
    });
  });

  it('leaves the ideas on that stage attached', async () => {
    const label = await store.createLabel(userId, 'Maturation');
    const idea = await ideas.createIdea(userId, 'une idée');
    await link(idea.id, label.id);

    await store.renameLabel(userId, label.id, 'À explorer');

    const links = await db()
      .selectFrom('idea_labels')
      .selectAll()
      .where('idea_id', '=', idea.id)
      .execute();

    expect(links).toHaveLength(1);
    expect(links[0]?.label_id).toBe(label.id);
  });

  it("refuses another account's stage", async () => {
    const other = await anotherAccount();
    const theirs = await store.createLabel(other.userId, 'Chez lui');

    expect(
      await store.renameLabel(userId, theirs.id, 'Volé'),
    ).toBeNull();
    expect(await names(other.userId)).toEqual(['Chez lui']);
  });

  it('answers null on a malformed id instead of letting Postgres raise', async () => {
    expect(
      await store.renameLabel(userId, 'pas-un-uuid', 'Peu importe'),
    ).toBeNull();
  });
});

describe('deleteLabel', () => {
  it('frees the ideas it carried without deleting them', async () => {
    const label = await store.createLabel(userId, 'Maturation');
    const idea = await ideas.createIdea(userId, 'une idée');
    await link(idea.id, label.id);

    expect(await store.deleteLabel(userId, label.id)).toBe(true);

    expect(await ideas.listIdeas(userId)).toHaveLength(1);
    const links = await db()
      .selectFrom('idea_labels')
      .selectAll()
      .execute();
    expect(links).toEqual([]);
  });

  it("refuses another account's stage", async () => {
    const other = await anotherAccount();
    const theirs = await store.createLabel(other.userId, 'Chez lui');

    expect(await store.deleteLabel(userId, theirs.id)).toBe(false);
    expect(await names(other.userId)).toEqual(['Chez lui']);
  });

  it('answers false on a malformed id', async () => {
    expect(await store.deleteLabel(userId, 'pas-un-uuid')).toBe(
      false,
    );
  });
});

describe('reorderLabels', () => {
  it('renumbers positions from one, in the order given', async () => {
    const first = await store.createLabel(userId, 'Un');
    const second = await store.createLabel(userId, 'Deux');
    const third = await store.createLabel(userId, 'Trois');

    const reordered = await store.reorderLabels(userId, [
      third.id,
      first.id,
      second.id,
    ]);

    expect(reordered).toMatchObject([
      { name: 'Trois', position: 1 },
      { name: 'Un', position: 2 },
      { name: 'Deux', position: 3 },
    ]);
  });

  it('leaves colours alone — reordering is not repainting', async () => {
    const first = await store.createLabel(userId, 'Un');
    const second = await store.createLabel(userId, 'Deux');

    const reordered = await store.reorderLabels(userId, [
      second.id,
      first.id,
    ]);

    expect(reordered.map((label) => label.color)).toEqual([2, 1]);
  });

  it('ignores an id belonging to another account', async () => {
    const other = await anotherAccount();
    const theirs = await store.createLabel(other.userId, 'Chez lui');
    const mine = await store.createLabel(userId, 'Chez moi');

    await store.reorderLabels(userId, [theirs.id, mine.id]);

    expect(await store.listLabels(other.userId)).toMatchObject([
      { name: 'Chez lui', position: 1 },
    ]);
  });
});

describe('the one-stage-per-idea constraint', () => {
  it('refuses a second stage on the same idea', async () => {
    const first = await store.createLabel(userId, 'Un');
    const second = await store.createLabel(userId, 'Deux');
    const idea = await ideas.createIdea(userId, 'une idée');
    await link(idea.id, first.id);

    await expect(link(idea.id, second.id)).rejects.toThrow(
      /idea_labels_one_per_idea/,
    );
  });
});
