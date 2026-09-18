import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '#store/db';
import * as store from '#store/ideas';
import { createUserWithSession } from '#test/factories';

// Every operation is scoped to an account, so the tests need one to exist.
let userId: string;

beforeEach(async () => {
  ({ userId } = await createUserWithSession());
});

// The database stamps updated_at with now(); fake timers cannot reach it.
// Rewriting the column is the only way to build a deterministic ordering.
const backdate = async (id: string, iso: string): Promise<void> => {
  await db()
    .updateTable('ideas')
    .set({ updated_at: new Date(iso) })
    .where('id', '=', id)
    .execute();
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('listIdeas', () => {
  it('starts empty', async () => {
    expect(await store.listIdeas(userId)).toEqual([]);
  });

  it('returns what was created', async () => {
    await store.createIdea(userId, 'une idée');

    const ideas = await store.listIdeas(userId);

    expect(ideas).toHaveLength(1);
    expect(ideas[0]?.variations[0]?.text).toBe('une idée');
  });
});

describe('createIdea', () => {
  it('is born free, with one initial variation', async () => {
    const idea = await store.createIdea(userId, 'une idée');

    expect(idea.labelId).toBeNull();
    expect(idea.variations).toHaveLength(1);
    expect(idea.createdAt).toBe(idea.updatedAt);
  });

  it('renders timestamps as strict ISO 8601, not as driver Dates', async () => {
    const idea = await store.createIdea(userId, 'une idée');

    expect(idea.createdAt).toMatch(ISO);
    expect(idea.variations[0]?.createdAt).toMatch(ISO);
  });
});

describe('deleteIdea', () => {
  it('takes the variations down with the idea', async () => {
    const idea = await store.createIdea(userId, 'une idée');

    expect(await store.deleteIdea(userId, idea.id)).toBe(true);

    const left = await db()
      .selectFrom('variations')
      .select('id')
      .where('idea_id', '=', idea.id)
      .execute();
    expect(left).toEqual([]);
  });
});

describe('unknown identifiers', () => {
  // Postgres rejects a malformed uuid outright. Without a guard in the store
  // these would raise a 500 where the contract owes a 404.
  it('treats a non-uuid id as not found', async () => {
    expect(await store.deleteIdea(userId, 'nope')).toBe(false);
    expect(await store.setLabel(userId, 'nope', null)).toBeNull();
    expect(
      await store.addVariation(userId, 'nope', 'suite'),
    ).toBeNull();
    expect(
      await store.editVariation(userId, 'nope', 'nope', 'x'),
    ).toBe('idea-not-found');
  });
});

describe('addVariation', () => {
  it('appends after the initial variation', async () => {
    const created = await store.createIdea(userId, 'première');

    const updated = await store.addVariation(
      userId,
      created.id,
      'seconde',
    );

    expect(
      updated?.variations.map((variation) => variation.text),
    ).toEqual(['première', 'seconde']);
  });
});

describe('editVariation', () => {
  it('tells an unknown idea apart from an unknown variation', async () => {
    const idea = await store.createIdea(userId, 'une idée');
    const variationId = idea.variations[0]!.id;
    const absent = '00000000-0000-4000-8000-000000000000';

    expect(
      await store.editVariation(userId, absent, variationId, 'x'),
    ).toBe('idea-not-found');
    expect(
      await store.editVariation(userId, idea.id, absent, 'x'),
    ).toBe('variation-not-found');
  });

  it('rewrites the text while freezing id and createdAt', async () => {
    const created = await store.createIdea(userId, 'une idée');
    const before = created.variations[0]!;

    const edited = await store.editVariation(
      userId,
      created.id,
      before.id,
      'corrigée',
    );

    expect(edited).not.toBe('idea-not-found');
    const after = (edited as typeof created).variations[0]!;
    expect(after.text).toBe('corrigée');
    expect(after.id).toBe(before.id);
    expect(after.createdAt).toBe(before.createdAt);
  });
});

describe('listIdeas ordering', () => {
  it('returns the most recently touched idea first', async () => {
    const first = await store.createIdea(userId, 'la plus ancienne');
    const middle = await store.createIdea(userId, 'celle du milieu');
    const last = await store.createIdea(userId, 'la plus récente');

    await backdate(first.id, '2026-01-01T10:00:00.000Z');
    await backdate(middle.id, '2026-01-01T11:00:00.000Z');
    await backdate(last.id, '2026-01-01T12:00:00.000Z');

    expect((await store.listIdeas(userId))[0]?.id).toBe(last.id);

    // Touching the oldest idea stamps it with now() and moves it to the front.
    await store.setLabel(userId, first.id, null);

    expect((await store.listIdeas(userId))[0]?.id).toBe(first.id);
  });

  it('orders ideas sharing a timestamp by descending id', async () => {
    const ideas = [
      await store.createIdea(userId, 'a'),
      await store.createIdea(userId, 'b'),
      await store.createIdea(userId, 'c'),
    ];
    for (const idea of ideas) {
      await backdate(idea.id, '2026-01-01T10:00:00.000Z');
    }

    const listed = await store.listIdeas(userId);
    const ids = listed.map((idea) => idea.id);

    // Without a genuine tie the assertion below would prove nothing.
    expect(new Set(listed.map((idea) => idea.updatedAt)).size).toBe(
      1,
    );
    expect(ids).toEqual([...ids].sort().reverse());
  });
});
