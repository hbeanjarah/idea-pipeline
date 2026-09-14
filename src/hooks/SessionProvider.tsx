import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SessionContext } from './useSession';
import type { Reply, Request } from '@/lib/protocol';

interface Props {
  children: ReactNode;
}

type SessionRequest = Extract<
  Request,
  { kind: 'session/status' | 'session/set' }
>;

// sendMessage rejects outright when nothing answers ("Receiving end does not
// exist"), so the rejection is swallowed here: an unreachable worker must leave
// the panel signed out, never stuck on a blank screen waiting forever.
const askConnected = async (
  request: SessionRequest,
): Promise<boolean> => {
  try {
    const reply = (await chrome.runtime.sendMessage(request)) as
      | Reply<'session/status'>
      | undefined;

    return reply?.ok === true && reply.data.connected;
  } catch {
    return false;
  }
};

export function SessionProvider({ children }: Props) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    // An effect callback cannot be async: React reads whatever it returns as
    // the cleanup function. The call is therefore started and not awaited —
    // the active flag above is what discards an answer that comes back late.
    void askConnected({ kind: 'session/status' }).then((result) => {
      if (!active) return;
      setConnected(result);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (token: string) => {
    setConnected(await askConnected({ kind: 'session/set', token }));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ kind: 'session/clear' });
    } catch {
      // The worker is unreachable; the panel still has to leave the session.
    }
    setConnected(false);
  }, []);

  const value = useMemo(
    () => ({ connected, checking, signIn, signOut }),
    [connected, checking, signIn, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
