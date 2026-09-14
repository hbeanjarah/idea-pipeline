// Holds the single shared ideas state and exposes it through IdeasContext.
// Mounted once in App. The only consumer of ideaRepository on the React side.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { ideaRepository } from '@/storage/storage';
import { failureOf } from '@/lib/failure';
import type { Failure } from '@/lib/protocol';
import type { Idea, Status } from '@/storage/types';
import { IdeasContext } from './useIdeas';

interface Props {
  children: ReactNode;
}

export function IdeasProvider({ children }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  // The operation that just failed, kept raw so it can be run again as is.
  const [pending, setPending] = useState<
    (() => Promise<unknown>) | null
  >(null);

  // Whether the list ever came back. A retry that succeeds while this is false
  // would leave the screen showing only what it just wrote, the rest of the
  // account staying missing until the panel is reopened.
  const loaded = useRef(false);

  // Throws on failure: attempt below is the single place that decides what a
  // failure means, including for the initial load.
  const reload = useCallback(async () => {
    setIdeas(await ideaRepository.list());
    loaded.current = true;
  }, []);

  // Every operation funnels through here, so the failure and the way to replay
  // it are built in one place rather than in each screen.
  const attempt = useCallback(
    async <T,>(run: () => Promise<T>): Promise<T> => {
      try {
        const result = await run();
        setFailure(null);
        setPending(null);

        // The write went through, so the server is back: fetch what the failed
        // load never delivered.
        if (!loaded.current) void reload().catch(() => undefined);

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
    [reload],
  );

  const retry = useMemo(
    () => (pending ? () => void attempt(pending) : null),
    [pending, attempt],
  );

  useEffect(() => {
    let active = true;

    // An effect callback cannot be async: React reads whatever it returns as
    // the cleanup function. The call is therefore started and not awaited —
    // the active flag is what discards an answer that comes back late.
    void ideaRepository
      .list()
      .then((fetched) => {
        if (!active) return;
        setIdeas(fetched);
        loaded.current = true;
        setFailure(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(failureOf(error));
        // Retried through attempt, so a second failure is handled like any
        // other rather than by a second code path.
        setPending(() => reload);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload]);

  // Driven by Composer, which owns the text and therefore owns the failure:
  // recording it here too would show two alerts for one outage. It throws, and
  // the caller decides.
  const create = useCallback(async (text: string) => {
    const idea = await ideaRepository.create(text);

    setIdeas((current) => [...current, idea]);

    return idea;
  }, []);

  const replace = (idea: Idea) =>
    setIdeas((current) =>
      current.map((item) => (item.id === idea.id ? idea : item)),
    );

  // Driven by Composer too — same reasoning as create.
  const addVariation = useCallback(
    async (ideaId: string, text: string) => {
      const idea = await ideaRepository.addVariation(ideaId, text);

      replace(idea);

      return idea;
    },
    [],
  );

  const editVariation = useCallback(
    (ideaId: string, variationId: string, text: string) =>
      attempt(async () => {
        const idea = await ideaRepository.editVariation(
          ideaId,
          variationId,
          text,
        );
        replace(idea);
        return idea;
      }),
    [attempt],
  );

  const changeStatus = useCallback(
    (ideaId: string, status: Status) =>
      attempt(async () => {
        const idea = await ideaRepository.changeStatus(
          ideaId,
          status,
        );
        replace(idea);
        return idea;
      }),
    [attempt],
  );

  const deleteIdea = useCallback(
    (ideaId: string) =>
      attempt(async () => {
        await ideaRepository.delete(ideaId);
        setIdeas((current) =>
          current.filter((item) => item.id !== ideaId),
        );
      }),
    [attempt],
  );

  const value = useMemo(
    () => ({
      ideas,
      loading,
      failure,
      retry,
      create,
      addVariation,
      editVariation,
      changeStatus,
      deleteIdea,
    }),
    [
      ideas,
      loading,
      failure,
      retry,
      create,
      addVariation,
      editVariation,
      changeStatus,
      deleteIdea,
    ],
  );

  return <IdeasContext value={value}>{children}</IdeasContext>;
}
