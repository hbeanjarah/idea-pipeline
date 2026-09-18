import LabelDot from '@/components/LabelDot/LabelDot';
import Popover from '@/components/Popover/Popover';
import type { Label } from '@/storage/types';
import styles from './LabelPicker.module.css';

interface Props {
  labels: Label[];
  labelId: string | null;
  onChange: (labelId: string | null) => void;
  onManage: () => void;
  className?: string;
}

const check = (
  <svg
    className={styles.check}
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export default function LabelPicker({
  labels,
  labelId,
  onChange,
  onManage,
  className,
}: Props) {
  const current =
    labels.find((label) => label.id === labelId) ?? null;

  return (
    <Popover
      trigger={
        <span className={`${styles.badge} ${className ?? ''}`}>
          <LabelDot color={current?.color ?? null} />
          {current?.name ?? 'Classer'}
          <svg
            className={styles.chevron}
            viewBox="0 0 24 24"
            width="11"
            height="11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      }
    >
      {(close) => (
        <div className={styles.menu}>
          <button
            type="button"
            className={`${styles.option} ${styles.none}`}
            onClick={() => {
              if (current !== null) onChange(null);
              close();
            }}
          >
            Aucune étape
            {current === null && check}
          </button>

          {labels.length > 0 && <hr className={styles.separator} />}

          {labels.map((label) => (
            <button
              key={label.id}
              type="button"
              className={styles.option}
              onClick={() => {
                if (label.id !== labelId) onChange(label.id);
                close();
              }}
            >
              <LabelDot color={label.color} />
              {label.name}
              {label.id === labelId && check}
            </button>
          ))}

          <hr className={styles.separator} />

          <button
            type="button"
            className={`${styles.option} ${
              labels.length === 0 ? styles.first : styles.manage
            }`}
            onClick={() => {
              close();
              onManage();
            }}
          >
            {labels.length === 0
              ? '＋ Créer une première étape'
              : 'Gérer les étapes…'}
          </button>
        </div>
      )}
    </Popover>
  );
}
