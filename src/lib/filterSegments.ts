import { ALL, UNCLASSIFIED } from '@/lib/filterIdeas';
import type { FilterLabel } from '@/lib/filterIdeas';
import type { Label } from '@/storage/types';

export interface Segment {
  value: FilterLabel;
  label: string;
  color: number | null;
}

export function orderSegments(
  labels: Label[],
  active: FilterLabel,
): Segment[] {
  const segments: Segment[] = [
    { value: ALL, label: 'Tous', color: null },
    { value: UNCLASSIFIED, label: 'Sans étape', color: null },
    ...labels.map((label) => ({
      value: label.id,
      label: label.name,
      color: label.color,
    })),
  ];

  // Second place, never further: the strip only keeps what fits on one row, and
  // an account with five stages pushes everything past the second pill out of
  // sight. Left where it belongs, the active one goes with it and the strip
  // stops saying what it filters.
  const at = segments.findIndex(
    (segment) => segment.value === active,
  );
  if (at > 1) segments.splice(1, 0, ...segments.splice(at, 1));

  return segments;
}
