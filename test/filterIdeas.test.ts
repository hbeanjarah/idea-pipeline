import { describe, it, expect } from 'vitest';
import { ALL, UNCLASSIFIED, filterIdeas } from '@/lib/filterIdeas';
import type { Idea, Variation } from '@/storage/types';

const CAPTURE = 'l-capture';
const MATURING = 'l-maturing';
const PUBLISHED = 'l-published';

// Minimal Idea fixture — only the fields filterIdeas reads matter here.
function makeIdea(
  id: string,
  labelId: string | null,
  texts: string[] = [id],
  title: string | null = null,
): Idea {
  const variations: Variation[] = texts.map((text, index) => ({
    id: `${id}-v${index + 1}`,
    text,
    createdAt: '2026-01-01T00:00:00.000Z',
  }));
  return {
    id,
    labelId,
    title,
    variations,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const ideas: Idea[] = [
  makeIdea('a', CAPTURE),
  makeIdea('b', MATURING),
  makeIdea('c', CAPTURE),
  makeIdea('d', null),
];

describe('filterIdeas', () => {
  describe('stage', () => {
    it('returns every idea when the filter is ALL', () => {
      expect(filterIdeas(ideas, { label: ALL })).toEqual(ideas);
    });

    it('returns only the ideas at a given stage', () => {
      const result = filterIdeas(ideas, { label: CAPTURE });
      expect(result.map((idea) => idea.id)).toEqual(['a', 'c']);
    });

    it('returns the ideas with no stage at all', () => {
      const result = filterIdeas(ideas, { label: UNCLASSIFIED });
      expect(result.map((idea) => idea.id)).toEqual(['d']);
    });

    it('never confuses a free idea with a stage that has none', () => {
      // Both answer "nothing here", and they must not answer the same thing:
      // UNCLASSIFIED is a real segment of the filter strip, not an empty one.
      expect(filterIdeas(ideas, { label: PUBLISHED })).toEqual([]);
      expect(
        filterIdeas(ideas, { label: UNCLASSIFIED }),
      ).toHaveLength(1);
    });

    it('returns an empty list when given an empty list', () => {
      expect(filterIdeas([], { label: ALL })).toEqual([]);
      expect(filterIdeas([], { label: CAPTURE })).toEqual([]);
      expect(filterIdeas([], { label: UNCLASSIFIED })).toEqual([]);
    });

    it('preserves input order', () => {
      const result = filterIdeas(ideas, { label: CAPTURE });
      expect(result).toEqual([ideas[0], ideas[2]]);
    });
  });

  describe('query', () => {
    const corpus: Idea[] = [
      makeIdea('react', CAPTURE, ['Why React beats everything']),
      makeIdea('history', MATURING, [
        'First take on hooks',
        'Now mostly about Vue',
      ]),
      makeIdea('plain', null, ['Shipping fast']),
    ];

    it('matches case-insensitively on a substring', () => {
      // "react" matches "React" (case) inside a longer word/phrase.
      const result = filterIdeas(corpus, {
        label: ALL,
        query: 'react',
      });
      expect(result.map((idea) => idea.id)).toEqual(['react']);
    });

    it('matches a term found in a non-latest variation', () => {
      // "hooks" only appears in the first variation, not the latest one.
      const result = filterIdeas(corpus, {
        label: ALL,
        query: 'hooks',
      });
      expect(result.map((idea) => idea.id)).toEqual(['history']);
    });

    it('treats an empty or blank query as a no-op', () => {
      expect(filterIdeas(corpus, { label: ALL, query: '' })).toEqual(
        corpus,
      );
      expect(
        filterIdeas(corpus, { label: ALL, query: '   ' }),
      ).toEqual(corpus);
    });

    it('combines stage and query as an intersection', () => {
      // "alpha" appears in several texts, but only one stage is kept.
      const mixed: Idea[] = [
        makeIdea('x', CAPTURE, ['alpha']),
        makeIdea('y', MATURING, ['alpha']),
        makeIdea('z', CAPTURE, ['beta']),
      ];
      const result = filterIdeas(mixed, {
        label: CAPTURE,
        query: 'alpha',
      });
      expect(result.map((idea) => idea.id)).toEqual(['x']);
    });

    it('returns an empty list when nothing contains the term', () => {
      expect(
        filterIdeas(corpus, { label: ALL, query: 'nonexistent' }),
      ).toEqual([]);
    });
  });
});
