import Popover from '@/components/Popover/Popover';
import type { Status } from '@/storage/types';
import styles from './StatusPicker.module.css';

// Provisional labels, kept in sync with the rest of the app (Home pipeline,
// StatusFilter). A shared label map would be a separate refactor.
const LABELS: Record<Status, string> = {
  captured: 'Capturé',
  maturing: 'Maturation',
  ready: 'Prêt',
  published: 'Publié',
};

// Pipeline order. Transitions are free: any step is reachable from any step.
const ORDER: Status[] = [
  'captured',
  'maturing',
  'ready',
  'published',
];

interface Props {
  status: Status;
  onChange: (status: Status) => void;
}

// The badge is the trigger: clicking it opens a popover listing the 4 steps.
// Selecting one reports a change only when it actually changes, but always
// closes.
export default function StatusPicker({ status, onChange }: Props) {
  return (
    <div className={styles.status}>
      <Popover
        trigger={
          <span className={styles.badge}>
            <span className={`${styles.dot} ${styles[status]}`} />
            {LABELS[status]}
            <svg
              className={styles.chevron}
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        }
      >
        {(close) => (
          <div className={styles.statusMenu}>
            {ORDER.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={styles.statusOption}
                onClick={() => {
                  if (candidate !== status) onChange(candidate);
                  close();
                }}
              >
                <span
                  className={`${styles.dot} ${styles[candidate]}`}
                />
                {LABELS[candidate]}
                {candidate === status && (
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
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}
