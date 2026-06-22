import { describe, it, expect } from 'vitest';
import { filterIdeas } from '../src/lib/filterIdeas';
import type { Idea, Status } from '../src/storage/types';

// Minimal Idea fixture — only the fields filterIdeas reads matter here.
function makeIdea(id: string, status: Status): Idea {
  return {
    id,
    status,
    variations: [
      {
        id: `${id}-v1`,
        text: id,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const ideas: Idea[] = [
  makeIdea('a', 'captured'),
  makeIdea('b', 'maturing'),
  makeIdea('c', 'captured'),
  makeIdea('d', 'published'),
];

describe('filterIdeas', () => {
  it("returns every idea when status is 'all'", () => {
    expect(filterIdeas(ideas, { status: 'all' })).toEqual(ideas);
  });

  it('returns only the ideas matching a specific status', () => {
    const result = filterIdeas(ideas, { status: 'captured' });
    expect(result.map((idea) => idea.id)).toEqual(['a', 'c']);
  });

  it('returns an empty list when no idea matches the status', () => {
    expect(filterIdeas(ideas, { status: 'ready' })).toEqual([]);
  });

  it('returns an empty list when given an empty list', () => {
    expect(filterIdeas([], { status: 'all' })).toEqual([]);
    expect(filterIdeas([], { status: 'captured' })).toEqual([]);
  });

  it('ignores query until the Search ticket wires it in', () => {
    // query is accepted but a no-op for now: same result with or without it.
    expect(
      filterIdeas(ideas, { status: 'all', query: 'anything' }),
    ).toEqual(ideas);
    expect(
      filterIdeas(ideas, { status: 'captured', query: 'zzz' }).map(
        (idea) => idea.id,
      ),
    ).toEqual(['a', 'c']);
  });

  it('preserves input order', () => {
    const result = filterIdeas(ideas, { status: 'captured' });
    expect(result).toEqual([ideas[0], ideas[2]]);
  });
});
