import { useEffect, useMemo, useRef, useState } from 'react';

import LabelDot from '@/components/LabelDot/LabelDot';
import Popover from '@/components/Popover/Popover';
import { ALL, UNCLASSIFIED } from '@/lib/filterIdeas';
import type { FilterLabel } from '@/lib/filterIdeas';
import { visibleCount } from '@/lib/rowOverflow';
import type { Label } from '@/storage/types';
import styles from './LabelFilter.module.css';

interface Props {
  labels: Label[];
  active: FilterLabel;
  counts: Record<string, number>;
  onChange: (value: FilterLabel) => void;
}

interface Segment {
  value: FilterLabel;
  label: string;
  color: number | null;
}

export default function LabelFilter({
  labels,
  active,
  counts,
  onChange,
}: Props) {
  // The active stage is pulled in front of the others: left in the overflow,
  // the strip would not say what it filters.
  const segments = useMemo<Segment[]>(() => {
    const stages: Segment[] = labels.map((label) => ({
      value: label.id,
      label: label.name,
      color: label.color,
    }));

    const at = stages.findIndex((stage) => stage.value === active);
    if (at > 0) stages.unshift(...stages.splice(at, 1));

    return [
      { value: ALL, label: 'Tous', color: null },
      { value: UNCLASSIFIED, label: 'Sans étape', color: null },
      ...stages,
    ];
  }, [labels, active]);

  const stripRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(segments.length);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const measure = () =>
      setShown(
        visibleCount(
          [...strip.children].map(
            (pill) => (pill as HTMLElement).offsetTop,
          ),
        ),
      );

    measure();

    // Showing the chip narrows the strip, which can only push more pills down,
    // never bring one back — so this cannot oscillate.
    const observer = new ResizeObserver(measure);
    observer.observe(strip);

    return () => observer.disconnect();
  }, [segments]);

  const hidden = segments.slice(shown);

  return (
    <div className={styles.bar}>
      <div className={styles.strip} ref={stripRef}>
        {segments.map(({ value, label, color }) => (
          <button
            key={value}
            type="button"
            className={`${styles.pill} ${active === value ? styles.on : ''}`}
            onClick={() => onChange(value)}
          >
            {color !== null && <LabelDot color={color} />}
            {label}
            <span className={styles.count}>{counts[value] ?? 0}</span>
          </button>
        ))}
      </div>

      {hidden.length > 0 && (
        <Popover
          align="end"
          trigger={
            <span className={`${styles.pill} ${styles.more}`}>
              +{hidden.length}
              <svg
                className={styles.chevron}
                viewBox="0 0 24 24"
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          }
        >
          {(close) => (
            <div className={styles.menu}>
              {hidden.map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  className={styles.entry}
                  onClick={() => {
                    onChange(value);
                    close();
                  }}
                >
                  <LabelDot color={color} />
                  {label}
                  <span className={styles.count}>
                    {counts[value] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}
