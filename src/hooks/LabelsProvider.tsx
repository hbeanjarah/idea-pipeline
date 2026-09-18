import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Label } from '@/storage/types';
import { labelRepository } from '@/storage/remote';
import { useFailureRetry } from './useFailureRetry';
import { LabelsContext } from './useLabels';

interface Props {
  children: ReactNode;
}

export function LabelsProvider({ children }: Props) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLabels(await labelRepository.list());
  }, []);

  const { failure, retry, attempt, markLoaded } =
    useFailureRetry(reload);

  useEffect(() => {
    let active = true;

    // An effect callback cannot be async — React reads what it returns as the
    // cleanup. Started and not awaited; `active` discards a late answer.
    void attempt(async () => {
      const fetched = await labelRepository.list();
      if (!active) return;
      setLabels(fetched);
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

  const create = useCallback(
    (name: string) =>
      attempt(async () => {
        const label = await labelRepository.create(name);
        setLabels((current) => [...current, label]);
        return label;
      }),
    [attempt],
  );

  const rename = useCallback(
    (labelId: string, name: string) =>
      attempt(async () => {
        const label = await labelRepository.rename(labelId, name);
        setLabels((current) =>
          current.map((item) =>
            item.id === label.id ? label : item,
          ),
        );
        return label;
      }),
    [attempt],
  );

  const remove = useCallback(
    (labelId: string) =>
      attempt(async () => {
        await labelRepository.delete(labelId);
        setLabels((current) =>
          current.filter((item) => item.id !== labelId),
        );
      }),
    [attempt],
  );

  // Applied locally first, put back as it was if the server refuses.
  const reorder = useCallback(
    (ids: string[]) =>
      attempt(async () => {
        const before = labels;

        setLabels(
          [...labels]
            .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
            // The list renders in array order, but position is what the next
            // reorder is built from: leaving it stale breaks the move after.
            .map((label, index) => ({
              ...label,
              position: index + 1,
            })),
        );

        try {
          const ordered = await labelRepository.reorder(ids);
          setLabels(ordered);
          return ordered;
        } catch (error) {
          setLabels(before);
          throw error;
        }
      }),
    [attempt, labels],
  );

  const value = useMemo(
    () => ({
      labels,
      loading,
      failure,
      retry,
      create,
      rename,
      remove,
      reorder,
    }),
    [
      labels,
      loading,
      failure,
      retry,
      create,
      rename,
      remove,
      reorder,
    ],
  );

  return <LabelsContext value={value}>{children}</LabelsContext>;
}
