// Holds the single shared ideas state and exposes it through IdeasContext.
// Mounted once in App. The only consumer of ideaRepository on the React side.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ideaRepository } from '@/storage/storage';
import type { OptimisticState } from '@/lib/optimistic';
import {
  confirmProvisional,
  dropProvisional,
  provisionalIdea,
  restoreAt,
  withProvisional,
} from '@/lib/optimistic';
import type { Idea, Status } from '@/storage/types';
import { useFailureRetry } from './useFailureRetry';
import { IdeasContext } from './useIdeas';

interface Props {
  children: ReactNode;
}

// The list and the ids awaiting confirmation move together, in one state: two
// useState would drift apart the moment one answer lands while another is still
// in flight.
const NOTHING: OptimisticState = { ideas: [], pendingIds: new Set() };

export function IdeasProvider({ children }: Props) {
  const [state, setState] = useState<OptimisticState>(NOTHING);
  const [loading, setLoading] = useState(true);

  // A full reload clears pendingIds: what the server hands back is confirmed
  // by definition.
  const reload = useCallback(async () => {
    setState({
      ideas: await ideaRepository.list(),
      pendingIds: new Set(),
    });
  }, []);

  const { failure, retry, attempt, markLoaded } =
    useFailureRetry(reload);

  useEffect(() => {
    let active = true;

    // Through attempt like every other operation, so a failed first load is
    // recorded and replayed by the same "Réessayer" as the rest.
    //
    // An effect callback cannot be async: React reads whatever it returns as
    // the cleanup function. The call is therefore started and not awaited —
    // the active flag is what discards an answer that comes back late.
    void attempt(async () => {
      const fetched = await ideaRepository.list();
      if (!active) return;
      setState({ ideas: fetched, pendingIds: new Set() });
      markLoaded();
    })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attempt, markLoaded]);

  // Driven by Composer, which owns the text and therefore owns the failure:
  // recording it here too would show two alerts for one outage. It throws, and
  // the caller decides.
  //
  // The idea is shown before the server has seen it. The provisional id is made
  // here and never leaves the panel: the answer replaces it.
  const create = useCallback(async (text: string) => {
    const provisional = provisionalIdea(
      text,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    setState((current) => withProvisional(current, provisional));

    try {
      const idea = await ideaRepository.create(text);
      setState((current) =>
        confirmProvisional(current, provisional.id, idea),
      );
      return idea;
    } catch (error) {
      setState((current) => dropProvisional(current, provisional.id));
      throw error;
    }
  }, []);

  // The ideas move, the pending marks stay. Named once so every write below
  // reads as what it does rather than as a state spread. Both are wrapped so
  // they can sit in the dependency lists below without recreating every write
  // on each render.
  const onIdeas = useCallback(
    (update: (ideas: Idea[]) => Idea[]) =>
      setState((current) => ({
        ...current,
        ideas: update(current.ideas),
      })),
    [],
  );

  const replace = useCallback(
    (idea: Idea) =>
      onIdeas((ideas) =>
        ideas.map((item) => (item.id === idea.id ? idea : item)),
      ),
    [onIdeas],
  );

  // Driven by Composer too — same reasoning as create.
  const addVariation = useCallback(
    async (ideaId: string, text: string) => {
      const idea = await ideaRepository.addVariation(ideaId, text);

      replace(idea);

      return idea;
    },
    [replace],
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
    [attempt, replace],
  );

  // Applied locally first, put back as it was if the server refuses. There is
  // no provisional idea to drop here — there is a previous value to restore.
  //
  // Two status changes started within one round trip is a known gap: the second
  // captures the first one's optimistic value as its "before", so if the second
  // fails it restores a status the server never had. Retrying re-syncs it. A
  // write queue would close it and is not worth its weight in a single panel.
  const changeStatus = useCallback(
    (ideaId: string, status: Status) =>
      attempt(async () => {
        const before = state.ideas.find((item) => item.id === ideaId);

        onIdeas((ideas) =>
          ideas.map((item) =>
            item.id === ideaId ? { ...item, status } : item,
          ),
        );

        try {
          const idea = await ideaRepository.changeStatus(
            ideaId,
            status,
          );
          replace(idea);
          return idea;
        } catch (error) {
          if (before) replace(before);
          throw error;
        }
      }),
    [attempt, replace, onIdeas, state.ideas],
  );

  const deleteIdea = useCallback(
    (ideaId: string) =>
      attempt(async () => {
        const index = state.ideas.findIndex(
          (item) => item.id === ideaId,
        );
        const removed = state.ideas[index];

        onIdeas((ideas) =>
          ideas.filter((item) => item.id !== ideaId),
        );

        try {
          await ideaRepository.delete(ideaId);
        } catch (error) {
          // Back at its index, not at the end: the caller sorts the list, but a
          // return to the bottom would still be seen for a render.
          if (removed)
            onIdeas((ideas) => restoreAt(ideas, index, removed));
          throw error;
        }
      }),
    [attempt, onIdeas, state.ideas],
  );

  const value = useMemo(
    () => ({
      ideas: state.ideas,
      pendingIds: state.pendingIds,
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
      state,
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
