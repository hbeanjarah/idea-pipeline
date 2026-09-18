import { useState } from 'react';
import ActionMenu from '@/components/ActionMenu/ActionMenu';
import BackButton from '@/components/BackButton/BackButton';
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
        <BackButton className={styles.back} onClick={onBack} />

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
