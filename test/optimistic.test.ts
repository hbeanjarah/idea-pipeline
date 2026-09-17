import { describe, expect, it } from 'vitest';

import {
  confirmProvisional,
  dropProvisional,
  provisionalIdea,
  restoreAt,
  withProvisional,
} from '@/lib/optimistic';
import type { Idea } from '@/storage/types';

const NOW = '2026-09-17T10:00:00.000Z';

const existing: Idea = {
  id: 'server-1',
  status: 'maturing',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  variations: [
    {
      id: 'v1',
      text: 'déjà là',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ],
};

const empty = { ideas: [existing], pendingIds: new Set<string>() };

describe('a provisional idea', () => {
  it('looks like what the server will send back', () => {
    const idea = provisionalIdea('une idée', 'tmp-1', NOW);

    expect(idea.id).toBe('tmp-1');
    expect(idea.status).toBe('captured');
    expect(idea.createdAt).toBe(NOW);
    expect(idea.updatedAt).toBe(NOW);
    expect(idea.variations).toHaveLength(1);
    expect(idea.variations[0].text).toBe('une idée');
  });
});

describe('adding a provisional idea', () => {
  it('appends it and marks it pending', () => {
    const next = withProvisional(
      empty,
      provisionalIdea('une idée', 'tmp-1', NOW),
    );

    expect(next.ideas.map((i) => i.id)).toEqual([
      'server-1',
      'tmp-1',
    ]);
    expect(next.pendingIds.has('tmp-1')).toBe(true);
  });

  it('leaves the previous state untouched', () => {
    withProvisional(empty, provisionalIdea('x', 'tmp-1', NOW));

    expect(empty.ideas).toHaveLength(1);
    expect(empty.pendingIds.size).toBe(0);
  });
});

describe('confirming a provisional idea', () => {
  const confirmed: Idea = { ...existing, id: 'server-2' };

  it('swaps it in place and clears the pending mark', () => {
    const pending = withProvisional(
      empty,
      provisionalIdea('une idée', 'tmp-1', NOW),
    );
    const next = confirmProvisional(pending, 'tmp-1', confirmed);

    expect(next.ideas.map((i) => i.id)).toEqual([
      'server-1',
      'server-2',
    ]);
    expect(next.pendingIds.size).toBe(0);
  });

  it('does nothing when the provisional idea is already gone', () => {
    const next = confirmProvisional(empty, 'tmp-1', confirmed);

    expect(next.ideas.map((i) => i.id)).toEqual(['server-1']);
  });
});

describe('dropping a provisional idea', () => {
  it('removes it and clears the pending mark', () => {
    const pending = withProvisional(
      empty,
      provisionalIdea('une idée', 'tmp-1', NOW),
    );
    const next = dropProvisional(pending, 'tmp-1');

    expect(next.ideas.map((i) => i.id)).toEqual(['server-1']);
    expect(next.pendingIds.size).toBe(0);
  });

  // Sans cette garde, un identifiant mal transmis effacerait une vraie idée.
  it('never removes a confirmed idea', () => {
    const next = dropProvisional(empty, 'server-1');

    expect(next.ideas.map((i) => i.id)).toEqual(['server-1']);
  });
});

describe('restoring an idea at its place', () => {
  const second: Idea = { ...existing, id: 'server-2' };
  const third: Idea = { ...existing, id: 'server-3' };

  it('puts it back where it was, not at the end', () => {
    const ideas = [existing, second, third];

    expect(
      restoreAt(
        ideas.filter((i) => i.id !== 'server-2'),
        1,
        second,
      ).map((i) => i.id),
    ).toEqual(['server-1', 'server-2', 'server-3']);
  });

  it('appends when the index is past the end', () => {
    expect(restoreAt([existing], 9, second).map((i) => i.id)).toEqual(
      ['server-1', 'server-2'],
    );
  });
});
