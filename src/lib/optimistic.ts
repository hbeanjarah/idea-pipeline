import type { Idea } from '@/storage/types';

export interface OptimisticState {
  ideas: Idea[];
  // Les idées affichées que le serveur n'a pas encore confirmées. Tenues avec
  // les idées dans un seul état : deux useState séparés se désynchronisent dès
  // qu'une réponse arrive pendant qu'une autre part.
  pendingIds: ReadonlySet<string>;
}

// Le panneau fabrique ici ce que le serveur produira : statut initial et dates.
// C'est une duplication assumée d'une règle serveur (voir interface-design.md),
// qui ne vit que le temps d'un aller-retour.
export function provisionalIdea(
  text: string,
  id: string,
  now: string,
): Idea {
  return {
    id,
    status: 'captured',
    createdAt: now,
    updatedAt: now,
    variations: [{ id: `${id}-v1`, text, createdAt: now }],
  };
}

const without = (
  pendingIds: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> => {
  const next = new Set(pendingIds);
  next.delete(id);
  return next;
};

export function withProvisional(
  state: OptimisticState,
  idea: Idea,
): OptimisticState {
  return {
    ideas: [...state.ideas, idea],
    pendingIds: new Set(state.pendingIds).add(idea.id),
  };
}

export function confirmProvisional(
  state: OptimisticState,
  provisionalId: string,
  confirmed: Idea,
): OptimisticState {
  if (!state.pendingIds.has(provisionalId)) return state;

  return {
    ideas: state.ideas.map((idea) =>
      idea.id === provisionalId ? confirmed : idea,
    ),
    pendingIds: without(state.pendingIds, provisionalId),
  };
}

// Ne retire que ce qui est en attente : une idée confirmée n'est jamais la
// victime d'un identifiant erroné.
export function dropProvisional(
  state: OptimisticState,
  provisionalId: string,
): OptimisticState {
  if (!state.pendingIds.has(provisionalId)) return state;

  return {
    ideas: state.ideas.filter((idea) => idea.id !== provisionalId),
    pendingIds: without(state.pendingIds, provisionalId),
  };
}

// Une suppression annulée doit revenir à sa place : la liste est triée par le
// consommateur, mais un retour en fin de tableau se verrait le temps d'un rendu.
export function restoreAt(
  ideas: Idea[],
  index: number,
  idea: Idea,
): Idea[] {
  const next = [...ideas];
  next.splice(index, 0, idea);
  return next;
}
