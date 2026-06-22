import { describe, it, expect } from 'vitest';
import { filterIdeas } from '../src/lib/filterIdeas';
import type { Idea, Status, Variation } from '../src/storage/types';

// Minimal Idea fixture — only the fields filterIdeas reads matter here.
function makeIdea(
  id: string,
  status: Status,
  texts: string[] = [id],
): Idea {
  const variations: Variation[] = texts.map((text, index) => ({
    id: `${id}-v${index + 1}`,
    text,
    createdAt: '2026-01-01T00:00:00.000Z',
  }));
  return {
    id,
    status,
    variations,
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
  describe('status', () => {
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

    it('preserves input order', () => {
      const result = filterIdeas(ideas, { status: 'captured' });
      expect(result).toEqual([ideas[0], ideas[2]]);
    });
  });

  describe('query', () => {
    const corpus: Idea[] = [
      makeIdea('react', 'captured', ['Why React beats everything']),
      makeIdea('history', 'maturing', [
        'First take on hooks',
        'Now mostly about Vue',
      ]),
      makeIdea('plain', 'published', ['Shipping fast']),
    ];

    it('matches case-insensitively on a substring', () => {
      // "react" matches "React" (case) inside a longer word/phrase.
      const result = filterIdeas(corpus, {
        status: 'all',
        query: 'react',
      });
      expect(result.map((idea) => idea.id)).toEqual(['react']);
    });

    it('matches a term found in a non-latest variation', () => {
      // "hooks" only appears in the first variation, not the latest one.
      const result = filterIdeas(corpus, {
        status: 'all',
        query: 'hooks',
      });
      expect(result.map((idea) => idea.id)).toEqual(['history']);
    });

    it('treats an empty or blank query as a no-op', () => {
      expect(
        filterIdeas(corpus, { status: 'all', query: '' }),
      ).toEqual(corpus);
      expect(
        filterIdeas(corpus, { status: 'all', query: '   ' }),
      ).toEqual(corpus);
    });

    it('combines status and query as an intersection', () => {
      // "a" appears in several texts, but only captured ideas are kept.
      const mixed: Idea[] = [
        makeIdea('x', 'captured', ['alpha']),
        makeIdea('y', 'maturing', ['alpha']),
        makeIdea('z', 'captured', ['beta']),
      ];
      const result = filterIdeas(mixed, {
        status: 'captured',
        query: 'alpha',
      });
      expect(result.map((idea) => idea.id)).toEqual(['x']);
    });

    it('returns an empty list when nothing contains the term', () => {
      expect(
        filterIdeas(corpus, { status: 'all', query: 'nonexistent' }),
      ).toEqual([]);
    });
  });
});
