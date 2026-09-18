import LabelPicker from '@/components/LabelPicker/LabelPicker';
import { currentVariation } from '@/lib/variations';
import type { Idea, Label } from '@/storage/types';
import styles from './IdeaCard.module.css';

interface Props {
  idea: Idea;
  labels: Label[];
  onClick: () => void;
  onLabelChange: (labelId: string | null) => void;
  onManageLabels: () => void;
  // Displayed while the write is still in flight.
  pending?: boolean;
  // This idea is the one open in the detail pane.
  selected?: boolean;
}

export default function IdeaCard({
  idea,
  labels,
  onClick,
  onLabelChange,
  onManageLabels,
  pending = false,
  selected = false,
}: Props) {
  const text = currentVariation(idea).text;
  const versionCount = idea.variations.length;

  return (
    <div
      className={[
        styles.card,
        pending ? styles.pending : '',
        selected ? styles.selected : '',
      ].join(' ')}
    >
      <button type="button" className={styles.open} onClick={onClick}>
        <span className={styles.text}>{text}</span>
      </button>

      <div className={styles.meta}>
        <LabelPicker
          className={styles.stage}
          labels={labels}
          labelId={idea.labelId}
          onChange={onLabelChange}
          onManage={onManageLabels}
        />
        {versionCount > 1 && (
          <span className={styles.versions}>
            {versionCount} versions
          </span>
        )}
      </div>
    </div>
  );
}
