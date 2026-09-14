import { useState } from 'react';
import ActionMenu from '@/components/ActionMenu/ActionMenu';
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
                <ActionMenu
                  label="Actions de la variation"
                  className={styles.verMenu}
                  actions={[
                    {
                      label: 'Modifier',
                      onSelect: () => setEditingId(variation.id),
                    },
                  ]}
                />
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
