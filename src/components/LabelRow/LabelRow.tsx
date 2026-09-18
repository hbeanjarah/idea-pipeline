import { useState } from 'react';
import type { PointerEvent } from 'react';

import LabelDot from '@/components/LabelDot/LabelDot';
import type { Label } from '@/storage/types';
import styles from './LabelRow.module.css';

const NAME_MAX = 32;

interface Props {
  label: Label;
  first: boolean;
  last: boolean;
  lifted: boolean;
  // How far the pointer has carried the row. Inline because it comes from the
  // pointer, not from the scale: no token can hold it.
  offset: number;
  onRename: (name: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  // The drag lives in the screen, which owns the list and its order.
  onGrab: (event: PointerEvent<HTMLElement>) => void;
}

export default function LabelRow({
  label,
  first,
  last,
  lifted,
  offset,
  onRename,
  onMove,
  onRemove,
  onGrab,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const name = (draft ?? '').trim();
    setDraft(null);
    if (name.length > 0 && name !== label.name) onRename(name);
  };

  return (
    // A div, not an li: the screen already wraps each row in one, and a nested
    // li is repaired by the browser closing the outer one early.
    <div
      className={`${styles.row} ${lifted ? styles.lifted : ''}`}
      style={
        lifted ? { transform: `translateY(${offset}px)` } : undefined
      }
    >
      <span
        className={styles.grip}
        onPointerDown={onGrab}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="currentColor"
        >
          <circle cx="9" cy="6" r="1.7" />
          <circle cx="15" cy="6" r="1.7" />
          <circle cx="9" cy="12" r="1.7" />
          <circle cx="15" cy="12" r="1.7" />
          <circle cx="9" cy="18" r="1.7" />
          <circle cx="15" cy="18" r="1.7" />
        </svg>
      </span>

      <LabelDot color={label.color} />

      {draft === null ? (
        <button
          type="button"
          className={styles.name}
          onClick={() => setDraft(label.name)}
        >
          {label.name}
        </button>
      ) : (
        <input
          className={styles.input}
          value={draft}
          maxLength={NAME_MAX}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') setDraft(null);
          }}
        />
      )}

      {draft === null && (
        <>
          {/* Not the cheap version of the drag: WCAG 2.2 (2.5.7) requires any
              dragging to also work with a single pointer. They ship together. */}
          <span className={styles.arrows}>
            <button
              type="button"
              className={styles.icon}
              disabled={first}
              aria-label={`Monter ${label.name}`}
              onClick={() => onMove(-1)}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V6" />
                <path d="M6 12l6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.icon}
              disabled={last}
              aria-label={`Descendre ${label.name}`}
              onClick={() => onMove(1)}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v13" />
                <path d="M18 12l-6 6-6-6" />
              </svg>
            </button>
          </span>

          <button
            type="button"
            className={`${styles.icon} ${styles.remove}`}
            aria-label={`Supprimer ${label.name}`}
            onClick={onRemove}
          >
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
