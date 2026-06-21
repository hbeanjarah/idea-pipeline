// Domain model — canonical reference: .claude/rules/storage.md.
// English everywhere; French lives only in the UI layer.

// The four pipeline stages.
export type Status = 'captured' | 'maturing' | 'ready' | 'published';

// A snapshot of the text at a point in time.
// APPEND-ONLY: an existing variation is never edited nor removed;
// evolving an idea means appending a new one.
export interface Variation {
  id: string;
  text: string;
  createdAt: string; // ISO 8601
}

// A living idea = a sequence of variations + a pipeline stage.
export interface Idea {
  id: string;
  status: Status;
  variations: Variation[]; // always >= 1 (the initial capture)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601, refreshed on every mutation
}
