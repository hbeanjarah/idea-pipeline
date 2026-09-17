import { STATUS_LABELS } from '@/lib/statusLabels';
import { currentVariation } from '@/lib/variations';
import type { Idea } from '@/storage/types';
import styles from './IdeaCard.module.css';

interface Props {
  idea: Idea;
  onClick: () => void;
  // Displayed while the write is still in flight.
  pending?: boolean;
}

// Presentational only: reads the idea, never mutates.
export default function IdeaCard({
  idea,
  onClick,
  pending = false,
}: Props) {
  const text = currentVariation(idea).text;
  const versionCount = idea.variations.length;

  return (
    <button
      type="button"
      className={`${styles.card} ${pending ? styles.pending : ''}`}
      onClick={onClick}
    >
      <span className={styles.text}>{text}</span>
      <span className={styles.meta}>
        <span className={`${styles.dot} ${styles[idea.status]}`} />
        {STATUS_LABELS[idea.status]}
        {versionCount > 1 && (
          <span className={styles.versions}>
            {versionCount} versions
          </span>
        )}
      </span>
    </button>
  );
}
