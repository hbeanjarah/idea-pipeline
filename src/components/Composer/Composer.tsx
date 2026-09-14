import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import Alert from '@/components/Alert/Alert';
import { failureOf } from '@/lib/failure';
import { failureText } from '@/lib/failureText';
import type { Failure } from '@/lib/protocol';
import styles from './Composer.module.css';

// Provisional placeholder; lot 4 will introduce a prop when reformulation needs it.
const PLACEHOLDER = 'Une idée…';

interface Props {
  // Returns a promise so the draft is only cleared once the write succeeded.
  onSubmit: (text: string) => Promise<unknown>;
  autoFocus?: boolean;
}

// Owns its draft text, and therefore its failure: the retry has to run through
// the same submit, or a successful one would leave the text behind and invite a
// duplicate. It still knows nothing of useIdeas or the repository.
export default function Composer({
  onSubmit,
  autoFocus = false,
}: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
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

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      await onSubmit(trimmed);
      // Cleared only once the write is confirmed: an idea typed and lost to a
      // network failure would be worse than the local-only behaviour we left.
      setText('');
      setFailure(null);
    } catch (error) {
      setFailure(failureOf(error));
    } finally {
      setBusy(false);
    }
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
      void submit();
    }
  };

  return (
    <>
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
          onClick={() => void submit()}
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

      {/* Outside the field's border, never over it: a failure must not cover
          the text it is about. */}
      {failure && (
        <Alert
          title={failureText(failure, 'write').title}
          onRetry={() => void submit()}
        >
          {failureText(failure, 'write').body}
        </Alert>
      )}
    </>
  );
}
