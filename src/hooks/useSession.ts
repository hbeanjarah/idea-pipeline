// Whether the worker holds a session, and who it belongs to. The panel never
// sees the token itself — only whether one exists.

import { createContext, useContext } from 'react';
import type { Displayable } from '@/lib/failureText';
import type { User } from '@/storage/types';

export interface SessionContextValue {
  connected: boolean;
  checking: boolean;
  // null until /auth/me answers. Nothing the user is doing waits on it.
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  // What the last sign-in attempt failed on, or null. A cancelled window is
  // not a failure and never lands here — hence Displayable, not Failure.
  signInFailure: Displayable | null;
  // Set when a sign-out never reached the server, so the session is still
  // alive there. Cleared by the next sign-in.
  signOutIncomplete: boolean;
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
