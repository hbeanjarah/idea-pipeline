import { useState } from 'react';
import ActionMenu from '@/components/ActionMenu/ActionMenu';
import VariationEditor from '@/components/VariationEditor/VariationEditor';
import type { Variation } from '@/storage/types';
import styles from './VariationThread.module.css';

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

// The versions the idea no longer says. The current one is not here: it lives
// in CurrentVersion.
export default function VariationThread({
  variations,
  onEdit,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className={styles.thread}>
      {variations.map((variation) => (
        <div key={variation.id} className={styles.ver}>
          {editingId === variation.id ? (
            // onEdit fixes the text of this version; it never adds one.
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
