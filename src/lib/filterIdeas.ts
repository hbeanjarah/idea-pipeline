import type { Idea, Status } from '../storage/types';

// 'all' = no status filtering (explicit, preferred over an optional status).
export type FilterStatus = Status | 'all';

// Full signature laid out now so the Search ticket fills `query` without
// re-signing: only `status` is wired here; `query` is accepted but ignored.
export interface FilterCriteria {
  status: FilterStatus;
  query?: string;
}

// Pure, in-memory filtering — no React, no repository. Preserves input order,
// so the caller keeps owning the sort.
export function filterIdeas(
  ideas: Idea[],
  criteria: FilterCriteria,
): Idea[] {
  const { status } = criteria;
  // `query` is intentionally unused until the Search ticket wires it in.
  if (status === 'all') return ideas;
  return ideas.filter((idea) => idea.status === status);
}
