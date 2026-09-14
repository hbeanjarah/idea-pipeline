// Whether the worker holds a session. The panel never sees the token itself —
// only whether one exists.

import { createContext, useContext } from 'react';

export interface SessionContextValue {
  connected: boolean;
  checking: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const SessionContext =
  createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      'useSession must be used within a SessionProvider',
    );
  }
  return context;
}
