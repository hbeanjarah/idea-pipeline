import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fresh module graph per test so the store underneath starts empty. Assertions
// match on shape, not `instanceof`: the ApiError class is re-created too.
type Service = typeof import('#services/ideas');

let service: Service;

beforeEach(async () => {
  vi.resetModules();
  service = await import('#services/ideas');
});

const REQUIRED_TEXT = {
  status: 400,
  message: 'Le champ "text" est obligatoire.',
};

describe('createIdea validation', () => {
  it('rejects an absent body', async () => {
    await expect(service.createIdea(undefined)).rejects.toMatchObject(
      REQUIRED_TEXT,
    );
  });

  it('rejects a non-object body', async () => {
    await expect(
      service.createIdea('une idée'),
    ).rejects.toMatchObject(REQUIRED_TEXT);
  });

  it('rejects a missing text', async () => {
    await expect(service.createIdea({})).rejects.toMatchObject(
      REQUIRED_TEXT,
    );
  });

  it('rejects an empty text', async () => {
    await expect(
      service.createIdea({ text: '' }),
    ).rejects.toMatchObject(REQUIRED_TEXT);
  });

  it('rejects a whitespace-only text', async () => {
    await expect(
      service.createIdea({ text: '   ' }),
    ).rejects.toMatchObject(REQUIRED_TEXT);
  });

  it('rejects an unauthorized extra field', async () => {
    await expect(
      service.createIdea({ text: 'une idée', status: 'published' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Champs non autorisés.',
    });
  });
});

describe('createIdea', () => {
  it('creates a captured idea carrying its first variation', async () => {
    const idea = await service.createIdea({ text: 'une idée' });

    expect(idea.status).toBe('captured');
    expect(idea.variations).toHaveLength(1);
    expect(idea.variations[0]?.text).toBe('une idée');
  });

  it('stores the text trimmed', async () => {
    const idea = await service.createIdea({ text: '  une idée  ' });

    expect(idea.variations[0]?.text).toBe('une idée');
  });
});

describe('listIdeas', () => {
  it('starts empty', async () => {
    expect(await service.listIdeas()).toEqual([]);
  });

  it('returns created ideas', async () => {
    await service.createIdea({ text: 'une idée' });

    expect(await service.listIdeas()).toHaveLength(1);
  });
});

describe('deleteIdea', () => {
  it('rejects an unknown idea', async () => {
    await expect(service.deleteIdea('nope')).rejects.toMatchObject({
      status: 404,
      message: 'Idée introuvable.',
    });
  });

  it('removes the idea', async () => {
    const idea = await service.createIdea({ text: 'une idée' });

    await service.deleteIdea(idea.id);

    expect(await service.listIdeas()).toEqual([]);
  });
});

describe('changeStatus', () => {
  it('rejects an unknown idea', async () => {
    await expect(
      service.changeStatus('nope', { status: 'ready' }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Idée introuvable.',
    });
  });

  // Zod reports an absent `status` and a bad value with the same issue code,
  // so these two must stay covered separately.
  it('rejects an absent status', async () => {
    const idea = await service.createIdea({ text: 'une idée' });

    await expect(
      service.changeStatus(idea.id, {}),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Le champ "status" est obligatoire.',
    });
  });

  it('rejects a status outside the enum', async () => {
    const idea = await service.createIdea({ text: 'une idée' });

    await expect(
      service.changeStatus(idea.id, { status: 'archived' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Statut invalide.',
    });
  });

  it('rejects an unauthorized extra field', async () => {
    const idea = await service.createIdea({ text: 'une idée' });

    await expect(
      service.changeStatus(idea.id, { status: 'ready', text: 'x' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Champs non autorisés.',
    });
  });

  it('moves the idea and refreshes updatedAt', async () => {
    const created = await service.createIdea({ text: 'une idée' });

    const moved = await service.changeStatus(created.id, {
      status: 'ready',
    });

    expect(moved.status).toBe('ready');
    expect(moved.createdAt).toBe(created.createdAt);
  });
});

describe('addVariation', () => {
  it('rejects an unknown idea', async () => {
    await expect(
      service.addVariation('nope', { text: 'suite' }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Idée introuvable.',
    });
  });

  it('rejects a blank text', async () => {
    const idea = await service.createIdea({ text: 'une idée' });

    await expect(
      service.addVariation(idea.id, { text: '   ' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Le champ "text" est obligatoire.',
    });
  });

  it('appends without touching the previous variations', async () => {
    const created = await service.createIdea({ text: 'une idée' });

    const grown = await service.addVariation(created.id, {
      text: 'suite',
    });

    expect(grown.variations).toHaveLength(2);
    expect(grown.variations[0]?.text).toBe('une idée');
    expect(grown.variations[1]?.text).toBe('suite');
  });
});

describe('editVariation', () => {
  it('tells an unknown idea apart from an unknown variation', async () => {
    const idea = await service.createIdea({ text: 'une idée' });
    const variationId = idea.variations[0]!.id;

    await expect(
      service.editVariation('nope', variationId, { text: 'x' }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Idée introuvable.',
    });

    await expect(
      service.editVariation(idea.id, 'nope', { text: 'x' }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Variation introuvable.',
    });
  });

  it('rejects a blank text before looking the idea up', async () => {
    await expect(
      service.editVariation('nope', 'nope', { text: '   ' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Le champ "text" est obligatoire.',
    });
  });

  it('rewrites the text in place', async () => {
    const created = await service.createIdea({ text: 'une idée' });

    const edited = await service.editVariation(
      created.id,
      created.variations[0]!.id,
      { text: 'corrigée' },
    );

    expect(edited.variations).toHaveLength(1);
    expect(edited.variations[0]?.text).toBe('corrigée');
  });
});
