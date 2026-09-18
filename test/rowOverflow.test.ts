import { describe, expect, it } from 'vitest';

import { visibleCount } from '@/lib/rowOverflow';

// These feed offsetTop values by hand. jsdom lays nothing out, so the real
// measurement cannot be tested here — only the decision made from it. Verifying
// that the strip measures right is done by narrowing the panel.
describe('visibleCount', () => {
  it('counts them all when nothing wrapped', () => {
    expect(visibleCount([0, 0, 0, 0])).toBe(4);
  });

  it('stops at the first pill pushed to the next row', () => {
    expect(visibleCount([0, 0, 0, 25, 25])).toBe(3);
  });

  it('keeps the first one even when it is the only one that fits', () => {
    expect(visibleCount([0, 25, 25])).toBe(1);
  });

  it('answers zero on an empty strip', () => {
    expect(visibleCount([])).toBe(0);
  });

  it('measures against the first row, not against zero', () => {
    // A strip that does not start at the top of its container: every top is
    // shifted, and only the differences matter.
    expect(visibleCount([40, 40, 65])).toBe(2);
  });

  it('counts a third row as hidden too, not as a new first row', () => {
    expect(visibleCount([0, 0, 25, 50])).toBe(2);
  });
});
