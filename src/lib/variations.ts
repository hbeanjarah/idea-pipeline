import type { Idea, Variation } from '@/storage/types';

// La dernière variation fait foi : c'est elle le texte courant de l'idée. Les
// précédentes sont son histoire — le modèle est en ajout seul (storage.md).
//
// variations n'est jamais vide, la capture initiale en pose toujours une.
export function currentVariation(idea: Idea): Variation {
  return idea.variations[idea.variations.length - 1];
}
