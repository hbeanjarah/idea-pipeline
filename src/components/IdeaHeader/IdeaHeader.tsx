import { useState } from 'react';
import Popover from '@/components/Popover/Popover';
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

        {/* Idea actions hub (⋮) — today a single entry (delete). Right-anchored
            popover so the menu stays inside the panel. */}
        {onDelete && (
          <Popover
            align="end"
            trigger={
              <svg
                className={styles.menuIcon}
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-label="Actions de l'idée"
              >
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            }
          >
            {(close) => (
              <div className={styles.actionMenu}>
                <button
                  type="button"
                  className={styles.deleteOption}
                  onClick={() => {
                    close();
                    setConfirming(true);
                  }}
                >
                  Supprimer l&rsquo;idée
                </button>
              </div>
            )}
          </Popover>
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
