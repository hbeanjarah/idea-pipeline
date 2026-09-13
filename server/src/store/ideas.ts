import { randomUUID } from 'node:crypto';

import type { Idea, Status } from '#domain/types';

const ideas = new Map<string, Idea>();

const snapshot = (idea: Idea): Idea => structuredClone(idea);

const now = (): string => new Date().toISOString();

export async function listIdeas(): Promise<Idea[]> {
  // The contract fixes the order: most recently touched first. ISO 8601 strings
  // compare chronologically, and the id breaks ties so two ideas sharing a
  // millisecond still come back in the same order on every call.
  return [...ideas.values()]
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) ||
        b.id.localeCompare(a.id),
    )
    .map(snapshot);
}

export async function createIdea(text: string): Promise<Idea> {
  const timestamp = now();
  const idea: Idea = {
    id: randomUUID(),
    status: 'captured',
    createdAt: timestamp,
    updatedAt: timestamp,
    variations: [{ id: randomUUID(), text, createdAt: timestamp }],
  };

  ideas.set(idea.id, idea);
  return snapshot(idea);
}

export async function deleteIdea(id: string): Promise<boolean> {
  return ideas.delete(id);
}

export async function changeStatus(
  id: string,
  status: Status,
): Promise<Idea | null> {
  const idea = ideas.get(id);
  if (!idea) return null;

  idea.status = status;
  idea.updatedAt = now();
  return snapshot(idea);
}

export async function addVariation(
  id: string,
  text: string,
): Promise<Idea | null> {
  const idea = ideas.get(id);
  if (!idea) return null;

  const timestamp = now();
  idea.variations.push({
    id: randomUUID(),
    text,
    createdAt: timestamp,
  });
  idea.updatedAt = timestamp;
  return snapshot(idea);
}

// A plain null cannot say which of the two lookups failed, and the API owes a
// different message for each.
export type EditVariationFailure =
  | 'idea-not-found'
  | 'variation-not-found';

export async function editVariation(
  id: string,
  variationId: string,
  text: string,
): Promise<Idea | EditVariationFailure> {
  const idea = ideas.get(id);
  if (!idea) return 'idea-not-found';

  const variation = idea.variations.find(
    (candidate) => candidate.id === variationId,
  );
  if (!variation) return 'variation-not-found';

  variation.text = text;
  idea.updatedAt = now();
  return snapshot(idea);
}
