import { createContext, useContext } from 'react';
import type { Displayable } from '@/lib/failureText';
import type { Idea } from '@/storage/types';

export interface IdeasContextValue {
  ideas: Idea[];
  // Shown, but not confirmed by the server yet. A screen dims these so the
  // panel never claims more than it knows.
  pendingIds: ReadonlySet<string>;
  loading: boolean;
  create: (text: string) => Promise<Idea>;
  addVariation: (ideaId: string, text: string) => Promise<Idea>;
  editVariation: (
    ideaId: string,
    variationId: string,
    text: string,
  ) => Promise<Idea>;
  setLabel: (ideaId: string, labelId: string | null) => Promise<Idea>;
  // Clears a deleted stage from the ideas already on screen. Local, immediate,
  // and never a network call.
  forgetLabel: (labelId: string) => void;
  deleteIdea: (ideaId: string) => Promise<void>;
  // What went wrong last, and how to try it again. Exposed here so no screen
  // invents its own error handling — they would drift.
  failure: Displayable | null;
  retry: (() => void) | null;
}

export const IdeasContext = createContext<IdeasContextValue | null>(
  null,
);

// The hook components call. Single shared instance — no prop-drilling.
export function useIdeas(): IdeasContextValue {
  const context = useContext(IdeasContext);
  if (!context) {
    throw new Error('useIdeas must be used within an IdeasProvider');
  }
  return context;
}
