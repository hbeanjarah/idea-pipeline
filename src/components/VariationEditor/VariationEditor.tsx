import { useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import styles from './VariationEditor.module.css';

interface Props {
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

// Inline editor for an existing variation. Presentational + behavioral only:
// it knows nothing of useIdeas or editVariation. Distinct from the Composer —
// it pre-fills and replaces, where the Composer creates and clears.
export default function VariationEditor({
  initialText,
  onSave,
  onCancel,
}: Props) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus on mount with the caret at the end — we are editing existing text,
  // so the cursor lands after it rather than selecting all.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, []);

  // Auto-resize: grow to fit the content; CSS max-height caps it and scrolls.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  }, [text]);

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    // Enter validates; Shift+Enter falls through to a newline; Escape cancels.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className={styles.editor}>
      <textarea
        ref={inputRef}
        className={styles.input}
        value={text}
        rows={1}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancel}
          onClick={onCancel}
          aria-label="Annuler"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.save}
          onClick={save}
          aria-label="Valider"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
