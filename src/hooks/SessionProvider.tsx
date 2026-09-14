import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SessionContext } from './useSession';
import type { Displayable } from '@/lib/failureText';
import type { Reply, Request } from '@/lib/protocol';
import type { User } from '@/storage/types';

interface Props {
  children: ReactNode;
}

type SessionKind = Extract<Request['kind'], `session/${string}`>;

// sendMessage rejects outright when nothing answers ("Receiving end does not
// exist"), so the rejection is swallowed here: an unreachable worker must leave
// the panel signed out, never stuck on a blank screen waiting forever.
const ask = async <K extends SessionKind>(
  request: Extract<Request, { kind: K }>,
): Promise<Reply<K> | null> => {
  try {
    return (await chrome.runtime.sendMessage(request)) as Reply<K>;
  } catch {
    return null;
  }
};

export function SessionProvider({ children }: Props) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [signInFailure, setSignInFailure] =
    useState<Displayable | null>(null);
  const [signOutIncomplete, setSignOutIncomplete] = useState(false);

  useEffect(() => {
    let active = true;

    // An effect callback cannot be async: React reads whatever it returns as
    // the cleanup function. The call is therefore started and not awaited —
    // the active flag above is what discards an answer that comes back late.
    void ask({ kind: 'session/status' }).then((reply) => {
      if (!active) return;
      setConnected(reply?.ok === true && reply.data.connected);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Only signing out turns connected back to false, and it clears the user
  // itself — so this effect only ever has to fetch, never to reset.
  useEffect(() => {
    if (!connected) return;
    let active = true;

    void ask({ kind: 'session/identity' }).then((reply) => {
      // A failure here is silent by design: the avatar stays in its waiting
      // state, and nothing the user is doing depends on knowing the email.
      if (active && reply?.ok) setUser(reply.data);
    });
    return () => {
      active = false;
    };
  }, [connected]);

  const signIn = useCallback(async () => {
    setSignOutIncomplete(false);
    const reply = await ask({ kind: 'session/signIn' });

    if (reply?.ok) {
      setUser(reply.data.user);
      setSignInFailure(null);
      setConnected(true);
      return;
    }
    // A closed window is not a failure: the screen stays exactly as it was.
    if (reply && reply.failure.reason === 'cancelled') return;

    setSignInFailure(
      reply?.ok === false && reply.failure.reason !== 'cancelled'
        ? reply.failure
        : { reason: 'server' },
    );
  }, []);

  const signOut = useCallback(async () => {
    const reply = await ask({ kind: 'session/signOut' });
    setSignOutIncomplete(reply?.ok === true && !reply.data.revoked);
    setUser(null);
    setConnected(false);
  }, []);

  const value = useMemo(
    () => ({
      connected,
      checking,
      user,
      signIn,
      signOut,
      signInFailure,
      signOutIncomplete,
    }),
    [
      connected,
      checking,
      user,
      signIn,
      signOut,
      signInFailure,
      signOutIncomplete,
    ],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
