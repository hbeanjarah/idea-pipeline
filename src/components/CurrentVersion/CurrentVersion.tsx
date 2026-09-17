import { useState } from 'react';
import VariationEditor from '@/components/VariationEditor/VariationEditor';
import type { Variation } from '@/storage/types';
import styles from './CurrentVersion.module.css';

interface Props {
  variation: Variation;
  // Rejects when the fix could not be saved, which keeps the editor open with
  // the text still in it.
  onFix: (text: string) => Promise<unknown>;
}

// Second real case of the read/edit switch — VariationThread holds the other,
// for the old versions. That is what earns it a file of its own.
export default function CurrentVersion({ variation, onFix }: Props) {
  const [fixing, setFixing] = useState(false);

  if (fixing) {
    return (
      <VariationEditor
        initialText={variation.text}
        onSave={async (text) => {
          await onFix(text);
          // Closed only once the fix is saved: a failure leaves the editor
          // open, with the text still in it.
          setFixing(false);
        }}
        onCancel={() => setFixing(false)}
      />
    );
  }

  return (
    <div className={styles.current}>
      {/* Before the text, not after: a float only pushes the lines that come
          after it in the source. */}
      <button
        type="button"
        className={styles.fix}
        onClick={() => setFixing(true)}
      >
        Corriger
      </button>
      <p className={styles.text}>{variation.text}</p>
    </div>
  );
}
