// React-side data access. Wraps the repository behind a Context so the screens
// never see chrome.storage — and the inside stays freely replaceable (backend).
// Context here is an explicit, PO-approved revision of structure.md's "no Context".

import { createContext, useContext } from 'react';
import type { Idea, Status } from '../storage/types';

export interface IdeasContextValue {
  ideas: Idea[];
  loading: boolean;
  create: (text: string) => Promise<Idea>;
  addVariation: (ideaId: string, text: string) => Promise<Idea>;
  editVariation: (
    ideaId: string,
    variationId: string,
    text: string,
  ) => Promise<Idea>;
  changeStatus: (ideaId: string, status: Status) => Promise<Idea>;
  deleteIdea: (ideaId: string) => Promise<void>;
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
