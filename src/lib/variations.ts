import type { Idea, Variation } from '@/storage/types';

// La dernière variation fait foi : c'est elle le texte courant de l'idée. Les
// précédentes sont son histoire — le modèle est en ajout seul (storage.md).
//
// variations n'est jamais vide, la capture initiale en pose toujours une.
export function currentVariation(idea: Idea): Variation {
  return idea.variations[idea.variations.length - 1];
}

export function previousVariations(idea: Idea): Variation[] {
  return idea.variations.slice(0, -1);
}

// Un brouillon identique au texte courant serait une version qui ne varie pas.
export function isMeaningfulDraft(
  draft: string,
  current: string,
): boolean {
  const trimmed = draft.trim();
  return trimmed.length > 0 && trimmed !== current.trim();
}
