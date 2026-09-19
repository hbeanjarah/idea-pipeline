import type { Idea } from '@/storage/types';

export interface OptimisticState {
  ideas: Idea[];
  // Shown, but not confirmed by the server yet.
  pendingIds: ReadonlySet<string>;
}

// Duplicates a server rule for the length of one round trip — see
// interface-design.md before changing what it guesses.
export function provisionalIdea(
  text: string,
  id: string,
  now: string,
): Idea {
  return {
    id,
    labelId: null,
    title: null,
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

// Pending only: a confirmed idea is never the victim of a wrong id.
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

// Not a push: the caller sorts the list, but a return to the bottom would
// still be seen for a render.
export function restoreAt(
  ideas: Idea[],
  index: number,
  idea: Idea,
): Idea[] {
  const next = [...ideas];
  next.splice(index, 0, idea);
  return next;
}
