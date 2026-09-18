import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ideaRepository } from '@/storage/remote';
import type { OptimisticState } from '@/lib/optimistic';
import {
  confirmProvisional,
  dropProvisional,
  provisionalIdea,
  restoreAt,
  withProvisional,
} from '@/lib/optimistic';
import type { Idea } from '@/storage/types';
import { useFailureRetry } from './useFailureRetry';
import { IdeasContext } from './useIdeas';

interface Props {
  children: ReactNode;
}

// One state, never two: split in two useState they drift apart the moment one
// answer lands while another is still in flight.
const NOTHING: OptimisticState = { ideas: [], pendingIds: new Set() };

export function IdeasProvider({ children }: Props) {
  const [state, setState] = useState<OptimisticState>(NOTHING);
  const [loading, setLoading] = useState(true);

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

    // An effect callback cannot be async — React reads what it returns as the
    // cleanup. Started and not awaited; `active` discards a late answer.
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

  // Not wrapped in attempt: Composer owns the text, and therefore the failure.
  // Recording it here too would show two alerts for one outage.
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

  // Not wrapped in attempt either — same reason as create.
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

  // Known gap: two changes started within one round trip make the second
  // capture the first one's optimistic value as its "before", so a failure
  // restores a stage the server never had. Retrying re-syncs it.
  const setLabel = useCallback(
    (ideaId: string, labelId: string | null) =>
      attempt(async () => {
        const before = state.ideas.find((item) => item.id === ideaId);

        onIdeas((ideas) =>
          ideas.map((item) =>
            item.id === ideaId ? { ...item, labelId } : item,
          ),
        );

        try {
          const idea = await ideaRepository.setLabel(ideaId, labelId);
          replace(idea);
          return idea;
        } catch (error) {
          if (before) replace(before);
          throw error;
        }
      }),
    [attempt, replace, onIdeas, state.ideas],
  );

  // Without it the panel keeps showing cards pointing at a stage that is gone:
  // the server freed them, this state did not.
  const forgetLabel = useCallback(
    (labelId: string) =>
      onIdeas((ideas) =>
        ideas.map((idea) =>
          idea.labelId === labelId
            ? { ...idea, labelId: null }
            : idea,
        ),
      ),
    [onIdeas],
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
      setLabel,
      forgetLabel,
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
      setLabel,
      forgetLabel,
      deleteIdea,
    ],
  );

  return <IdeasContext value={value}>{children}</IdeasContext>;
}
