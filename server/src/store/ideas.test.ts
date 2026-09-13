import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// The store holds its ideas in a module-level Map. Rather than add a reset hook
// to production code, each test gets a fresh module graph.
type Store = typeof import('#store/ideas');

let store: Store;

beforeEach(async () => {
  vi.resetModules();
  store = await import('#store/ideas');
});

describe('listIdeas', () => {
  it('starts empty', async () => {
    expect(await store.listIdeas()).toEqual([]);
  });

  it('returns what was created', async () => {
    await store.createIdea('une idée');

    const ideas = await store.listIdeas();

    expect(ideas).toHaveLength(1);
    expect(ideas[0]?.variations[0]?.text).toBe('une idée');
  });
});

describe('createIdea', () => {
  it('enters the pipeline as captured, with one initial variation', async () => {
    const idea = await store.createIdea('une idée');

    expect(idea.status).toBe('captured');
    expect(idea.variations).toHaveLength(1);
    expect(idea.createdAt).toBe(idea.updatedAt);
  });

  it('hands back a copy, never the stored object', async () => {
    const idea = await store.createIdea('une idée');

    idea.status = 'published';

    const [stored] = await store.listIdeas();
    expect(stored?.status).toBe('captured');
  });
});

describe('editVariation', () => {
  it('tells an unknown idea apart from an unknown variation', async () => {
    const idea = await store.createIdea('une idée');
    const variationId = idea.variations[0]!.id;

    expect(await store.editVariation('nope', variationId, 'x')).toBe(
      'idea-not-found',
    );
    expect(await store.editVariation(idea.id, 'nope', 'x')).toBe(
      'variation-not-found',
    );
  });

  it('rewrites the text while freezing id and createdAt', async () => {
    const created = await store.createIdea('une idée');
    const before = created.variations[0]!;

    const edited = await store.editVariation(
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
  // Real timestamps collide: several ideas created in the same millisecond
  // share an updatedAt, which is exactly the case the tiebreaker exists for.
  // Driving the clock makes both cases reachable on purpose.
  const at = (iso: string) => vi.setSystemTime(new Date(iso));

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the most recently touched idea first', async () => {
    at('2026-01-01T10:00:00.000Z');
    const first = await store.createIdea('la plus ancienne');
    at('2026-01-01T11:00:00.000Z');
    await store.createIdea('celle du milieu');
    at('2026-01-01T12:00:00.000Z');
    const last = await store.createIdea('la plus récente');

    expect((await store.listIdeas())[0]?.id).toBe(last.id);

    // Touching the oldest idea moves it to the front.
    at('2026-01-01T13:00:00.000Z');
    await store.changeStatus(first.id, 'ready');

    expect((await store.listIdeas())[0]?.id).toBe(first.id);
  });

  it('orders ideas sharing a timestamp by descending id', async () => {
    at('2026-01-01T10:00:00.000Z');
    await store.createIdea('a');
    await store.createIdea('b');
    await store.createIdea('c');

    const ids = (await store.listIdeas()).map((idea) => idea.id);

    expect(ids).toEqual([...ids].sort().reverse());
  });
});
