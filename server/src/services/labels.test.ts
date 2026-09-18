import { beforeEach, describe, expect, it } from 'vitest';

import * as service from '#services/labels';
import { createUserWithSession } from '#test/factories';

let userId: string;

beforeEach(async () => {
  ({ userId } = await createUserWithSession());
});

const REQUIRED_NAME = {
  status: 400,
  message: "Le nom de l'étape est obligatoire.",
};
const TOO_LONG = {
  status: 400,
  message: "Le nom de l'étape est trop long.",
};
const DUPLICATE = {
  status: 400,
  message: 'Cette étape existe déjà.',
};
const NOT_FOUND = { status: 404, message: 'Étape introuvable.' };
const INCOMPLETE = {
  status: 400,
  message: 'La liste des étapes est incomplète.',
};
const UNKNOWN_FIELD = {
  status: 400,
  message: 'Champs non autorisés.',
};

const ABSENT = '99999999-9999-4999-8999-999999999999';

describe('createLabel validation', () => {
  it('rejects an absent body', async () => {
    await expect(
      service.createLabel(userId, undefined),
    ).rejects.toMatchObject(REQUIRED_NAME);
  });

  it('rejects a non-object body', async () => {
    await expect(
      service.createLabel(userId, 'Maturation'),
    ).rejects.toMatchObject(REQUIRED_NAME);
  });

  it('rejects a missing name', async () => {
    await expect(
      service.createLabel(userId, {}),
    ).rejects.toMatchObject(REQUIRED_NAME);
  });

  it('rejects a whitespace-only name', async () => {
    await expect(
      service.createLabel(userId, { name: '   ' }),
    ).rejects.toMatchObject(REQUIRED_NAME);
  });

  it('rejects a name of 33 characters', async () => {
    await expect(
      service.createLabel(userId, { name: 'a'.repeat(33) }),
    ).rejects.toMatchObject(TOO_LONG);
  });

  it('accepts exactly 32', async () => {
    const label = await service.createLabel(userId, {
      name: 'a'.repeat(32),
    });

    expect(label.name).toHaveLength(32);
  });

  it('rejects an unauthorized extra field', async () => {
    await expect(
      service.createLabel(userId, { name: 'Prêt', color: 3 }),
    ).rejects.toMatchObject(UNKNOWN_FIELD);
  });

  it('stores the trimmed name', async () => {
    expect(
      (await service.createLabel(userId, { name: '  Prêt  ' })).name,
    ).toBe('Prêt');
  });
});

describe('duplicate names', () => {
  it('refuses one that differs only by case', async () => {
    await service.createLabel(userId, { name: 'Prêt' });

    await expect(
      service.createLabel(userId, { name: 'prêt' }),
    ).rejects.toMatchObject(DUPLICATE);
  });

  it('accepts one that differs by an accent', async () => {
    await service.createLabel(userId, { name: 'Prêt' });

    // Same rule as search: « é » ≠ « e ». Folding accents here would make the
    // two rules disagree on what counts as the same word.
    expect(
      (await service.createLabel(userId, { name: 'Pret' })).name,
    ).toBe('Pret');
  });

  it('lets another account use the same name', async () => {
    const other = await createUserWithSession('autre@example.test');
    await service.createLabel(other.userId, { name: 'Prêt' });

    expect(
      (await service.createLabel(userId, { name: 'Prêt' })).name,
    ).toBe('Prêt');
  });

  it('refuses a rename onto another stage of the account', async () => {
    await service.createLabel(userId, { name: 'Prêt' });
    const second = await service.createLabel(userId, {
      name: 'Publié',
    });

    await expect(
      service.renameLabel(userId, second.id, { name: 'prêt' }),
    ).rejects.toMatchObject(DUPLICATE);
  });

  it('lets a stage keep its own name', async () => {
    const label = await service.createLabel(userId, { name: 'Prêt' });

    expect(
      (await service.renameLabel(userId, label.id, { name: 'Prêt' }))
        .name,
    ).toBe('Prêt');
  });
});

describe('renameLabel and deleteLabel', () => {
  it('rename answers 404 on an unknown id', async () => {
    await expect(
      service.renameLabel(userId, ABSENT, { name: 'Peu importe' }),
    ).rejects.toMatchObject(NOT_FOUND);
  });

  it('rename answers 404 on a malformed id', async () => {
    await expect(
      service.renameLabel(userId, 'pas-un-uuid', {
        name: 'Peu importe',
      }),
    ).rejects.toMatchObject(NOT_FOUND);
  });

  it('delete answers 404 on an unknown id', async () => {
    await expect(
      service.deleteLabel(userId, ABSENT),
    ).rejects.toMatchObject(NOT_FOUND);
  });

  it("delete answers 404 on another account's stage", async () => {
    const other = await createUserWithSession('autre@example.test');
    const theirs = await service.createLabel(other.userId, {
      name: 'Chez lui',
    });

    await expect(
      service.deleteLabel(userId, theirs.id),
    ).rejects.toMatchObject(NOT_FOUND);
  });
});

describe('reorderLabels validation', () => {
  it('rejects an absent body', async () => {
    await expect(
      service.reorderLabels(userId, undefined),
    ).rejects.toMatchObject(INCOMPLETE);
  });

  it('rejects an unauthorized extra field', async () => {
    const label = await service.createLabel(userId, { name: 'Un' });

    await expect(
      service.reorderLabels(userId, { ids: [label.id], why: 'non' }),
    ).rejects.toMatchObject(UNKNOWN_FIELD);
  });

  it('rejects a list missing one of the stages', async () => {
    const first = await service.createLabel(userId, { name: 'Un' });
    await service.createLabel(userId, { name: 'Deux' });

    await expect(
      service.reorderLabels(userId, { ids: [first.id] }),
    ).rejects.toMatchObject(INCOMPLETE);
  });

  it('rejects a list carrying a stranger id', async () => {
    const other = await createUserWithSession('autre@example.test');
    const theirs = await service.createLabel(other.userId, {
      name: 'Chez lui',
    });
    await service.createLabel(userId, { name: 'Chez moi' });

    await expect(
      service.reorderLabels(userId, { ids: [theirs.id] }),
    ).rejects.toMatchObject(INCOMPLETE);
  });

  it('rejects the same id twice', async () => {
    const label = await service.createLabel(userId, { name: 'Un' });

    // Passes the set comparison on a one-stage account, and would write
    // position 1 then 2 to the same row.
    await expect(
      service.reorderLabels(userId, { ids: [label.id, label.id] }),
    ).rejects.toMatchObject(INCOMPLETE);
  });

  it('renumbers the whole list in the order given', async () => {
    const first = await service.createLabel(userId, { name: 'Un' });
    const second = await service.createLabel(userId, {
      name: 'Deux',
    });

    expect(
      await service.reorderLabels(userId, {
        ids: [second.id, first.id],
      }),
    ).toMatchObject([
      { name: 'Deux', position: 1 },
      { name: 'Un', position: 2 },
    ]);
  });
});
