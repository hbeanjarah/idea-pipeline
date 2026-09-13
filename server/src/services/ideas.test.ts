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
  // Express 5 leaves req.body undefined when no parser matched — typically a
  // request sent without Content-Type. That must be a 400, never a 500.
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
