import { useState } from 'react';
import Popover from '@/components/Popover/Popover';
import VariationEditor from '@/components/VariationEditor/VariationEditor';
import type { Variation } from '@/storage/types';
import styles from './VariationThread.module.css';

// ISO 8601 -> readable timestamp with time (mono metadata in the UI).
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  variations: Variation[];
  // Rejects when the edit could not be saved, which keeps the editor open.
  onEdit: (variationId: string, text: string) => Promise<unknown>;
}

// Presentational: owns only which variation is being edited, which is display
// state. Saving is the screen's business.
export default function VariationThread({
  variations,
  onEdit,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className={styles.thread}>
      {variations.map((variation, index) => (
        <div
          key={variation.id}
          className={`${styles.ver} ${
            index === variations.length - 1 ? styles.current : ''
          }`}
        >
          {editingId === variation.id ? (
            // Editing in place: onEdit fixes the text, never adds a version.
            // The first variation uses this same path.
            <VariationEditor
              initialText={variation.text}
              onSave={async (text) => {
                await onEdit(variation.id, text);
                // Closed only once the edit is saved: a failure leaves the
                // editor open, with the text still in it.
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <div className={styles.verHead}>
                <p className={styles.text}>{variation.text}</p>
                {/* ⋮ variation-actions: always visible but faint, darkens on
                    hover. Today a single entry (edit). */}
                <Popover
                  align="end"
                  trigger={
                    <svg
                      className={styles.verMenu}
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="currentColor"
                      aria-label="Actions de la variation"
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
                        className={styles.editOption}
                        onClick={() => {
                          close();
                          setEditingId(variation.id);
                        }}
                      >
                        Modifier
                      </button>
                    </div>
                  )}
                </Popover>
              </div>
              <span className={styles.date}>
                {formatTimestamp(variation.createdAt)}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
