import type { Idea } from '@/storage/types';

// Sentinels beside the stage ids, which are uuids: they cannot collide.
export const ALL = 'all';
export const UNCLASSIFIED = 'none';

export type FilterLabel = string;

export interface FilterCriteria {
  label: FilterLabel;
  query?: string;
}

export function filterIdeas(
  ideas: Idea[],
  criteria: FilterCriteria,
): Idea[] {
  const { label, query } = criteria;

  const byLabel =
    label === ALL
      ? ideas
      : label === UNCLASSIFIED
        ? ideas.filter((idea) => idea.labelId === null)
        : ideas.filter((idea) => idea.labelId === label);

  const term = query?.trim().toLowerCase();
  if (!term) return byLabel;

  return byLabel.filter(
    (idea) =>
      idea.title?.toLowerCase().includes(term) === true ||
      idea.variations.some((variation) =>
        variation.text.toLowerCase().includes(term),
      ),
  );
}
