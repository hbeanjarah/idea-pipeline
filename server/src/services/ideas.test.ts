import { beforeEach, describe, expect, it } from 'vitest';

import * as service from '#services/ideas';
import * as labelService from '#services/labels';
import { createUserWithSession } from '#test/factories';

// Every operation is scoped to an account, so the tests need one to exist.
let userId: string;

beforeEach(async () => {
  ({ userId } = await createUserWithSession());
});

const REQUIRED_TEXT = {
  status: 400,
  message: 'Le champ "text" est obligatoire.',
};

describe('createIdea validation', () => {
  it('rejects an absent body', async () => {
    await expect(
      service.createIdea(userId, undefined),
    ).rejects.toMatchObject(REQUIRED_TEXT);
  });

  it('rejects a non-object body', async () => {
    await expect(
      service.createIdea(userId, 'une idée'),
    ).rejects.toMatchObject(REQUIRED_TEXT);
  });

  it('rejects a missing text', async () => {
    await expect(
      service.createIdea(userId, {}),
    ).rejects.toMatchObject(REQUIRED_TEXT);
  });

  it('rejects an empty text', async () => {
    await expect(
      service.createIdea(userId, { text: '' }),
    ).rejects.toMatchObject(REQUIRED_TEXT);
  });

  it('rejects a whitespace-only text', async () => {
    await expect(
      service.createIdea(userId, { text: '   ' }),
    ).rejects.toMatchObject(REQUIRED_TEXT);
  });

  it('rejects an unauthorized extra field', async () => {
    await expect(
      service.createIdea(userId, {
        text: 'une idée',
        status: 'published',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Champs non autorisés.',
    });
  });
});

describe('createIdea', () => {
  it('creates a free idea carrying its first variation', async () => {
    const idea = await service.createIdea(userId, {
      text: 'une idée',
    });

    expect(idea.labelId).toBeNull();
    expect(idea.variations).toHaveLength(1);
    expect(idea.variations[0]?.text).toBe('une idée');
  });

  it('stores the text trimmed', async () => {
    const idea = await service.createIdea(userId, {
      text: '  une idée  ',
    });

    expect(idea.variations[0]?.text).toBe('une idée');
  });
});

describe('listIdeas', () => {
  it('starts empty', async () => {
    expect(await service.listIdeas(userId)).toEqual([]);
  });

  it('returns created ideas', async () => {
    await service.createIdea(userId, { text: 'une idée' });

    expect(await service.listIdeas(userId)).toHaveLength(1);
  });
});

describe('deleteIdea', () => {
  it('rejects an unknown idea', async () => {
    await expect(
      service.deleteIdea(userId, 'nope'),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Idée introuvable.',
    });
  });

  it('removes the idea', async () => {
    const idea = await service.createIdea(userId, {
      text: 'une idée',
    });

    await service.deleteIdea(userId, idea.id);

    expect(await service.listIdeas(userId)).toEqual([]);
  });
});

describe('setIdeaLabel', () => {
  // The account is born with its four stages: taking one is closer to what
  // actually happens than inventing a fifth.
  const aStage = async () =>
    (await labelService.listLabels(userId))[0]!;

  it('rejects an unknown idea', async () => {
    await expect(
      service.setIdeaLabel(userId, 'nope', { labelId: null }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Idée introuvable.',
    });
  });

  it('rejects an absent labelId', async () => {
    const idea = await service.createIdea(userId, {
      text: 'une idée',
    });

    await expect(
      service.setIdeaLabel(userId, idea.id, {}),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Le champ "labelId" est obligatoire.',
    });
  });

  it('rejects a labelId that is neither a string nor null', async () => {
    const idea = await service.createIdea(userId, {
      text: 'une idée',
    });

    await expect(
      service.setIdeaLabel(userId, idea.id, { labelId: 3 }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Le champ "labelId" est obligatoire.',
    });
  });

  it('rejects an unauthorized extra field', async () => {
    const idea = await service.createIdea(userId, {
      text: 'une idée',
    });

    await expect(
      service.setIdeaLabel(userId, idea.id, {
        labelId: null,
        text: 'x',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Champs non autorisés.',
    });
  });

  it('rejects an unknown stage with 404, not a foreign-key crash', async () => {
    const idea = await service.createIdea(userId, {
      text: 'une idée',
    });

    await expect(
      service.setIdeaLabel(userId, idea.id, {
        labelId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Étape introuvable.',
    });
  });

  it("rejects another account's stage", async () => {
    const other = await createUserWithSession('autre@example.test');
    const theirs = await labelService.createLabel(other.userId, {
      name: 'Chez lui',
    });
    const idea = await service.createIdea(userId, {
      text: 'une idée',
    });

    await expect(
      service.setIdeaLabel(userId, idea.id, { labelId: theirs.id }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Étape introuvable.',
    });
  });

  it('attaches the stage and refreshes updatedAt', async () => {
    const stage = await aStage();
    const created = await service.createIdea(userId, {
      text: 'une idée',
    });

    const moved = await service.setIdeaLabel(userId, created.id, {
      labelId: stage.id,
    });

    expect(moved.labelId).toBe(stage.id);
    expect(moved.createdAt).toBe(created.createdAt);
  });

  it('detaches with null, leaving the idea alone', async () => {
    const stage = await aStage();
    const created = await service.createIdea(userId, {
      text: 'une idée',
    });
    await service.setIdeaLabel(userId, created.id, {
      labelId: stage.id,
    });

    const freed = await service.setIdeaLabel(userId, created.id, {
      labelId: null,
    });

    expect(freed.labelId).toBeNull();
    expect(freed.variations).toHaveLength(1);
  });
});

const REQUIRED_TITLE = {
  status: 400,
  message: 'Le champ "title" est obligatoire.',
};

describe('setIdeaTitle validation', () => {
  let ideaId: string;

  beforeEach(async () => {
    const idea = await service.createIdea(userId, {
      text: 'une idée',
    });
    ideaId = idea.id;
  });

  it('rejects an absent body', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, undefined),
    ).rejects.toMatchObject(REQUIRED_TITLE);
  });

  it('rejects a missing title', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, {}),
    ).rejects.toMatchObject(REQUIRED_TITLE);
  });

  it('rejects a title that is neither a string nor null', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, { title: 7 }),
    ).rejects.toMatchObject(REQUIRED_TITLE);
  });

  it('rejects a title beyond 80 characters', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, { title: 'a'.repeat(81) }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Le titre est trop long.',
    });
  });

  it('rejects a field outside the schema', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, { title: 'x', color: 1 }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Champs non autorisés.',
    });
  });

  it('answers 404 on an idea that does not exist', async () => {
    await expect(
      service.setIdeaTitle(
        userId,
        '00000000-0000-4000-8000-000000000000',
        { title: 'x' },
      ),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Idée introuvable.',
    });
  });
});

describe('setIdeaTitle', () => {
  it('trims the stored title', async () => {
    const created = await service.createIdea(userId, {
      text: 'une idée',
    });

    const idea = await service.setIdeaTitle(userId, created.id, {
      title: '  Un titre  ',
    });

    expect(idea.title).toBe('Un titre');
  });

  it('reads null and a blank string as the same removal', async () => {
    const created = await service.createIdea(userId, {
      text: 'une idée',
    });
    await service.setIdeaTitle(userId, created.id, {
      title: 'Un titre',
    });

    const blanked = await service.setIdeaTitle(userId, created.id, {
      title: '   ',
    });
    expect(blanked.title).toBeNull();

    await service.setIdeaTitle(userId, created.id, {
      title: 'Un titre',
    });
    const nulled = await service.setIdeaTitle(userId, created.id, {
      title: null,
    });
    expect(nulled.title).toBeNull();
  });

  it('accepts a title of exactly 80 characters', async () => {
    const created = await service.createIdea(userId, {
      text: 'une idée',
    });

    const idea = await service.setIdeaTitle(userId, created.id, {
      title: 'a'.repeat(80),
    });

    expect(idea.title).toHaveLength(80);
  });

  it('leaves the text and the stage alone', async () => {
    const created = await service.createIdea(userId, {
      text: 'une idée',
    });

    const idea = await service.setIdeaTitle(userId, created.id, {
      title: 'Un titre',
    });

    expect(idea.labelId).toBeNull();
    expect(idea.variations[0]?.text).toBe('une idée');
  });
});
