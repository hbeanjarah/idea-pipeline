// What went wrong last, and how to run it again. Split out of IdeasProvider,
// which owns the ideas: this hook never sees them. Its only tie to the data is
// `reload`, which it calls in two recovery cases.

import { useCallback, useMemo, useRef, useState } from 'react';

import { failureOf } from '@/lib/failure';
import type { Displayable } from '@/lib/failureText';

export interface FailureRetry {
  failure: Displayable | null;
  retry: (() => void) | null;
  // Every operation funnels through here, so the failure and the way to replay
  // it are built in one place rather than in each screen. Rethrows, so the
  // caller still decides what a failure means for its own state.
  attempt: <T>(run: () => Promise<T>) => Promise<T>;
  // Called by the owner once the collection has come back at least once.
  markLoaded: () => void;
}

export function useFailureRetry(
  reload: () => Promise<unknown>,
): FailureRetry {
  const [failure, setFailure] = useState<Displayable | null>(null);
  // The operation that just failed, kept raw so it can be run again as is.
  const [pending, setPending] = useState<
    (() => Promise<unknown>) | null
  >(null);

  // Whether the collection ever came back. A retry that succeeds while this is
  // false would leave the screen showing only what it just wrote, the rest of
  // the account staying missing until the panel is reopened.
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

        // The write went through, so the server is back: fetch what the failed
        // load never delivered. Marked here and not in reload, or every later
        // write would keep re-fetching the whole collection.
        if (!loaded.current)
          void reload()
            .then(markLoaded)
            .catch(() => undefined);

        return result;
      } catch (error) {
        const next = failureOf(error);

        // An idea deleted on another device is not something to retry: this
        // list is simply out of date. Refreshing it may fail too, and that
        // failure is not the one worth showing.
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
