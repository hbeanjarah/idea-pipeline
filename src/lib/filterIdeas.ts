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
// so the caller keeps owning the sort. Status and query combine (intersection).
export function filterIdeas(
  ideas: Idea[],
  criteria: FilterCriteria,
): Idea[] {
  const { status, query } = criteria;

  const byStatus =
    status === 'all'
      ? ideas
      : ideas.filter((idea) => idea.status === status);

  // Empty / blank query is a no-op. Case-insensitive substring match, no accent
  // normalization (MVP: é ≠ e). Scans every variation, not just the latest.
  const term = query?.trim().toLowerCase();
  if (!term) return byStatus;

  return byStatus.filter((idea) =>
    idea.variations.some((variation) =>
      variation.text.toLowerCase().includes(term),
    ),
  );
}
