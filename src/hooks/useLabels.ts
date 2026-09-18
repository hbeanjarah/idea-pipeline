import { createContext, useContext } from 'react';

import type { Displayable } from '@/lib/failureText';
import type { Label } from '@/storage/types';

export interface LabelsContextValue {
  // In display order. An empty list is a legal state, not a failure: an account
  // can have deleted every stage.
  labels: Label[];
  loading: boolean;
  create: (name: string) => Promise<Label>;
  rename: (labelId: string, name: string) => Promise<Label>;
  remove: (labelId: string) => Promise<void>;
  // The whole ordered list, not a move.
  reorder: (ids: string[]) => Promise<Label[]>;
  failure: Displayable | null;
  retry: (() => void) | null;
}

export const LabelsContext = createContext<LabelsContextValue | null>(
  null,
);

export function useLabels(): LabelsContextValue {
  const context = useContext(LabelsContext);
  if (!context) {
    throw new Error('useLabels must be used within a LabelsProvider');
  }
  return context;
}
