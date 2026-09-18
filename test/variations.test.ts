import { describe, expect, it } from 'vitest';

import {
  currentVariation,
  previousVariations,
} from '@/lib/variations';
import type { Idea } from '@/storage/types';

const ideaWith = (...texts: string[]): Idea => ({
  id: 'i1',
  labelId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  variations: texts.map((text, index) => ({
    id: `v${index + 1}`,
    text,
    createdAt: `2026-01-0${index + 1}T00:00:00.000Z`,
  })),
});

describe('the current variation', () => {
  it('is the last one, not the first', () => {
    const idea = ideaWith('premier jet', 'deuxième', 'troisième');

    expect(currentVariation(idea).text).toBe('troisième');
  });

  it('is the only one when the idea has never been reformulated', () => {
    expect(currentVariation(ideaWith('seule')).text).toBe('seule');
  });
});

describe('the previous variations', () => {
  it('are everything but the last, oldest first', () => {
    const idea = ideaWith('premier jet', 'deuxième', 'troisième');

    expect(previousVariations(idea).map((v) => v.text)).toEqual([
      'premier jet',
      'deuxième',
    ]);
  });

  it('are empty when the idea has never been reformulated', () => {
    expect(previousVariations(ideaWith('seule'))).toEqual([]);
  });
});
