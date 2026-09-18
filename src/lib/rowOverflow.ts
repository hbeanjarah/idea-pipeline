// `tops` are the offsetTop of a wrapping strip's items, in DOM order: the ones
// the browser pushed to a second row sit lower than the first.
export function visibleCount(tops: readonly number[]): number {
  const first = tops[0];
  if (first === undefined) return 0;

  const pushed = tops.findIndex((top) => top > first);

  return pushed === -1 ? tops.length : pushed;
}
