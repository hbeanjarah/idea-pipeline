import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import styles from './IdeaTitle.module.css';

const MAX = 80;
const EMPTY = 'Ajouter un titre';
const HINT = '⏎ pour enregistrer · Échap pour annuler';

interface Props {
  title: string | null;
  onChange: (title: string | null) => Promise<unknown>;
}

export default function IdeaTitle({ title, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape unmounts the input, and removing a focused node fires blur: without
  // this latch, cancelling would save on the way out.
  const closing = useRef(false);

  useLayoutEffect(() => {
    if (!editing) return;
    closing.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const close = (commit: boolean) => {
    if (closing.current) return;
    closing.current = true;

    const typed = inputRef.current?.value.trim() ?? '';
    setEditing(false);

    if (!commit) return;

    const next = typed === '' ? null : typed;
    if (next !== title) void onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      close(true);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close(false);
    }
  };

  return (
    <>
      {editing ? (
        <input
          ref={inputRef}
          className={styles.input}
          defaultValue={title ?? ''}
          placeholder={EMPTY}
          maxLength={MAX}
          aria-label="Titre de l'idée"
          onKeyDown={handleKeyDown}
          onBlur={() => close(true)}
        />
      ) : (
        <button
          type="button"
          className={[
            styles.line,
            title === null ? styles.empty : '',
          ].join(' ')}
          onClick={() => setEditing(true)}
        >
          {title ?? EMPTY}
        </button>
      )}

      <p
        className={[styles.hint, editing ? '' : styles.silent].join(
          ' ',
        )}
      >
        {HINT}
      </p>
    </>
  );
}
