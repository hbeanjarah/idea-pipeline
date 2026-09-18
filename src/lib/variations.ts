import type { Idea, Variation } from '@/storage/types';

// Safe to index without a guard: variations is never empty, the initial
// capture always lays one down (storage.md).
export function currentVariation(idea: Idea): Variation {
  return idea.variations[idea.variations.length - 1];
}

export function previousVariations(idea: Idea): Variation[] {
  return idea.variations.slice(0, -1);
}

export function isMeaningfulDraft(
  draft: string,
  current: string,
): boolean {
  const trimmed = draft.trim();
  return trimmed.length > 0 && trimmed !== current.trim();
}
