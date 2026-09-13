import { randomUUID } from 'node:crypto';

import type { Idea, Status } from './types.js';

// Async throughout even though nothing awaits: ticket B swaps this module for
// Postgres, and every caller must already be written for it.

const ideas = new Map<string, Idea>();

// Callers get copies, never the stored object.
const snapshot = (idea: Idea): Idea => structuredClone(idea);

const now = (): string => new Date().toISOString();

export async function listIdeas(): Promise<Idea[]> {
  return [...ideas.values()].map(snapshot);
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

export async function editVariation(
  id: string,
  variationId: string,
  text: string,
): Promise<Idea | null> {
  const idea = ideas.get(id);
  if (!idea) return null;

  const variation = idea.variations.find(
    (candidate) => candidate.id === variationId,
  );
  if (!variation) return null;

  variation.text = text;
  idea.updatedAt = now();
  return snapshot(idea);
}
