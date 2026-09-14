import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SessionContext } from './useSession';
import type { Reply, Request } from '@/lib/protocol';

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

  const signIn = useCallback(async () => {
    const reply = await ask({ kind: 'session/signIn' });
    if (reply?.ok) setConnected(true);
  }, []);

  const signOut = useCallback(async () => {
    await ask({ kind: 'session/signOut' });
    setConnected(false);
  }, []);

  const value = useMemo(
    () => ({ connected, checking, signIn, signOut }),
    [connected, checking, signIn, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
