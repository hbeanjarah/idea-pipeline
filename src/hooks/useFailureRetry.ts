import { useCallback, useMemo, useRef, useState } from 'react';

import { failureOf } from '@/lib/failure';
import type { Displayable } from '@/lib/failureText';

export interface FailureRetry {
  failure: Displayable | null;
  retry: (() => void) | null;
  // Rethrows: recording the failure here does not spare the caller from
  // handling it.
  attempt: <T>(run: () => Promise<T>) => Promise<T>;
  markLoaded: () => void;
}

export function useFailureRetry(
  reload: () => Promise<unknown>,
): FailureRetry {
  const [failure, setFailure] = useState<Displayable | null>(null);
  const [pending, setPending] = useState<
    (() => Promise<unknown>) | null
  >(null);

  // Drop this and a retry that succeeds leaves the screen showing only what it
  // just wrote, the rest of the account missing until the panel is reopened.
  const loaded = useRef(false);

  const markLoaded = useCallback(() => {
    loaded.current = true;
  }, []);

  const attempt = useCallback(
    async <T>(run: () => Promise<T>): Promise<T> => {
      try {
        const result = await run();
        setFailure(null);
        setPending(null);

        // Marked here and not inside reload, or every later write would
        // re-fetch the whole collection.
        if (!loaded.current)
          void reload()
            .then(markLoaded)
            .catch(() => undefined);

        return result;
      } catch (error) {
        const next = failureOf(error);

        // Swallowed on purpose: the refresh may fail too, and that failure is
        // not the one worth showing.
        if (next.reason === 'gone')
          void reload().catch(() => undefined);

        setFailure(next);
        setPending(() => run);
        throw error;
      }
    },
    [reload, markLoaded],
  );

  const retry = useMemo(
    () => (pending ? () => void attempt(pending) : null),
    [pending, attempt],
  );

  return { failure, retry, attempt, markLoaded };
}
