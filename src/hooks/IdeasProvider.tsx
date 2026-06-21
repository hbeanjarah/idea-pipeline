// Holds the single shared ideas state and exposes it through IdeasContext.
// Mounted once in App. The only consumer of ideaRepository on the React side.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ideaRepository } from '../storage/storage';
import type { Idea, Status } from '../storage/types';
import { IdeasContext } from './useIdeas';

interface Props {
  children: ReactNode;
}

export function IdeasProvider({ children }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial load only.
  useEffect(() => {
    let active = true;

    void ideaRepository.list().then((loaded) => {
      if (active) {
        setIdeas(loaded);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const create = useCallback(async (text: string) => {
    const idea = await ideaRepository.create(text);

    setIdeas((current) => [...current, idea]);

    return idea;
  }, []);

  const addVariation = useCallback(
    async (ideaId: string, text: string) => {
      const idea = await ideaRepository.addVariation(ideaId, text);

      setIdeas((current) =>
        current.map((item) => (item.id === idea.id ? idea : item)),
      );

      return idea;
    },
    [],
  );

  const changeStatus = useCallback(
    async (ideaId: string, status: Status) => {
      const idea = await ideaRepository.changeStatus(ideaId, status);

      setIdeas((current) =>
        current.map((item) => (item.id === idea.id ? idea : item)),
      );

      return idea;
    },
    [],
  );

  const deleteIdea = useCallback(async (ideaId: string) => {
    await ideaRepository.delete(ideaId);

    setIdeas((current) =>
      current.filter((item) => item.id !== ideaId),
    );
  }, []);

  const value = useMemo(
    () => ({
      ideas,
      loading,
      create,
      addVariation,
      changeStatus,
      deleteIdea,
    }),
    [ideas, loading, create, addVariation, changeStatus, deleteIdea],
  );

  return <IdeasContext value={value}>{children}</IdeasContext>;
}
