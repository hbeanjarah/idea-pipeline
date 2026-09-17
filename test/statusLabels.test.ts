import { describe, expect, it } from 'vitest';

import { STATUS_LABELS, STATUS_ORDER } from '@/lib/statusLabels';
import type { Status } from '@/storage/types';

// Écrit à la main plutôt que dérivé de STATUS_ORDER : un test qui se compare à
// lui-même passerait même si une étape disparaissait des deux côtés.
const EVERY_STATUS: Status[] = [
  'captured',
  'maturing',
  'ready',
  'published',
];

describe('the status labels', () => {
  it('names every stage of the pipeline', () => {
    for (const status of EVERY_STATUS) {
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('lists every stage exactly once, in pipeline order', () => {
    expect(STATUS_ORDER).toEqual(EVERY_STATUS);
  });
});
