// Data access layer. The ONLY place that touches chrome.storage.
// Model + invariants: canonical reference is .claude/rules/storage.md.

import type { Idea, Status, Variation } from './types';

// Single storage key holding the whole collection.
const STORAGE_KEY = 'ideas';

// Every read/write goes through this interface. No direct chrome.storage
// access lives anywhere else in the codebase.
export interface IdeaRepository {
  list(): Promise<Idea[]>;
  create(text: string): Promise<Idea>; // creates the idea + its first variation
  addVariation(ideaId: string, text: string): Promise<Idea>;
  changeStatus(ideaId: string, status: Status): Promise<Idea>;
  delete(ideaId: string): Promise<void>; // permanent deletion
}

export class ChromeStorageIdeaRepository implements IdeaRepository {
  async list(): Promise<Idea[]> {
    return this.readAll();
  }

  async create(text: string): Promise<Idea> {
    const now = this.now();
    // A fresh idea always enters the pipeline as 'captured' — never created
    // directly in another status. status is forced here, not a parameter.
    const idea: Idea = {
      id: crypto.randomUUID(),
      status: 'captured',
      variations: [{ id: crypto.randomUUID(), text, createdAt: now }],
      createdAt: now,
      updatedAt: now,
    };
    const ideas = await this.readAll();
    ideas.push(idea);
    await this.writeAll(ideas);
    return idea;
  }

  async addVariation(ideaId: string, text: string): Promise<Idea> {
    const ideas = await this.readAll();
    const idea = this.require(ideas, ideaId);
    const now = this.now();
    // Append-only: never edit or drop an existing variation.
    const variation: Variation = {
      id: crypto.randomUUID(),
      text,
      createdAt: now,
    };
    idea.variations.push(variation);
    idea.updatedAt = now;
    await this.writeAll(ideas);
    return idea;
  }

  async changeStatus(ideaId: string, status: Status): Promise<Idea> {
    const ideas = await this.readAll();
    const idea = this.require(ideas, ideaId);
    idea.status = status;
    idea.updatedAt = this.now();
    await this.writeAll(ideas);
    return idea;
  }

  async delete(ideaId: string): Promise<void> {
    const ideas = await this.readAll();
    const next = ideas.filter((idea) => idea.id !== ideaId);
    await this.writeAll(next);
  }

  private async readAll(): Promise<Idea[]> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const value = result[STORAGE_KEY];
    // Storage is untyped (structured clone): a corrupted non-array value
    // ("", "[]" as a string, an object) must fall back to an empty list
    // instead of slipping through and crashing every mutator (r.push…).
    return Array.isArray(value) ? (value as Idea[]) : [];
  }

  private async writeAll(ideas: Idea[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: ideas });
  }

  // Locate an idea or fail: a mutator must return an Idea, impossible if absent.
  private require(ideas: Idea[], ideaId: string): Idea {
    const idea = ideas.find((candidate) => candidate.id === ideaId);
    if (!idea) {
      throw new Error(`Idea not found: ${ideaId}`);
    }
    return idea;
  }

  private now(): string {
    return new Date().toISOString();
  }
}

// Singleton the screens import for all data access.
export const ideaRepository = new ChromeStorageIdeaRepository();
