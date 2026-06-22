import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import styles from './Composer.module.css';

// Provisional placeholder; lot 4 will introduce a prop when reformulation needs it.
const PLACEHOLDER = 'Une idée…';

interface Props {
  onSubmit: (text: string) => void;
  autoFocus?: boolean;
}

// Presentational only: owns its draft text locally and hands the trimmed text
// up on submit. Knows nothing of useIdeas or the repository.
export default function Composer({
  onSubmit,
  autoFocus = false,
}: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus on mount when requested — programmatic, via the existing textarea ref
  // (more robust than React's native autoFocus attribute in a Side Panel).
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Auto-resize: grow to fit the content; CSS max-height caps it and scrolls.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  }, [text]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    // Enter submits; Shift+Enter falls through to a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.composer}>
      <textarea
        ref={inputRef}
        className={styles.input}
        value={text}
        placeholder={PLACEHOLDER}
        rows={1}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className={styles.send}
        onClick={submit}
        aria-label="Enregistrer"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M7 5.4 L18.6 12 L7 18.6 Q9.4 12 7 5.4 Z" />
        </svg>
      </button>
    </div>
  );
}
