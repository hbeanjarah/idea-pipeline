import type { Idea } from '../../storage/types';
import styles from './IdeaCard.module.css';

interface Props {
  idea: Idea;
  onClick: () => void;
}

// Presentational only: reads the idea, never mutates. Shows the original
// (first) variation as a preview + a status dot. Click opens the detail (lot 4).
export default function IdeaCard({ idea, onClick }: Props) {
  // variations is guaranteed >= 1, so the first one is always present.
  const text = idea.variations[0].text;
  const versionCount = idea.variations.length;

  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <span className={styles.text}>{text}</span>
      <span className={styles.meta}>
        <span className={`${styles.dot} ${styles[idea.status]}`} />
        {versionCount > 1 && (
          <span className={styles.versions}>
            · {versionCount} versions
          </span>
        )}
      </span>
    </button>
  );
}
