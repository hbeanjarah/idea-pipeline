import { createContext, useContext } from 'react';
import type { Displayable } from '@/lib/failureText';
import type { Idea } from '@/storage/types';

export interface IdeasContextValue {
  ideas: Idea[];
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
  setTitle: (ideaId: string, title: string | null) => Promise<Idea>;

  forgetLabel: (labelId: string) => void;
  deleteIdea: (ideaId: string) => Promise<void>;

  failure: Displayable | null;
  retry: (() => void) | null;
}

export const IdeasContext = createContext<IdeasContextValue | null>(
  null,
);

export function useIdeas(): IdeasContextValue {
  const context = useContext(IdeasContext);
  if (!context) {
    throw new Error('useIdeas must be used within an IdeasProvider');
  }
  return context;
}
