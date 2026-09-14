import { useState } from 'react';
import ActionMenu from '@/components/ActionMenu/ActionMenu';
import styles from './IdeaHeader.module.css';

interface Props {
  onBack: () => void;
  // Absent while no idea is loaded: there is nothing to act on.
  onDelete?: () => void;
}

// Presentational: owns only the two-step confirmation, which is display state.
// Deleting itself is the screen's business.
export default function IdeaHeader({ onBack, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          aria-label="Retour à la liste"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M11 19l-7-7 7-7" />
          </svg>
        </button>

        {onDelete && (
          <ActionMenu
            label="Actions de l'idée"
            className={styles.menuIcon}
            actions={[
              {
                label: 'Supprimer l’idée',
                tone: 'danger',
                onSelect: () => setConfirming(true),
              },
            ]}
          />
        )}
      </div>

      {/* Inline two-step confirmation, pinned under the header. Delete is only
          run on the second click; deletion is permanent (no trash). */}
      {onDelete && confirming && (
        <div className={styles.confirmBar}>
          <span className={styles.confirmText}>
            Supprimer cette idée définitivement&nbsp;?
          </span>
          <button
            type="button"
            className={styles.confirmCancel}
            onClick={() => setConfirming(false)}
          >
            Annuler
          </button>
          <button
            type="button"
            className={styles.confirmDelete}
            onClick={onDelete}
          >
            Supprimer
          </button>
        </div>
      )}
    </>
  );
}
