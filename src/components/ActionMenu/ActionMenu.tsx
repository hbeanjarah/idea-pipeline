import Popover from '@/components/Popover/Popover';
import styles from './ActionMenu.module.css';

export interface Action {
  label: string;
  onSelect: () => void;
  // 'danger' marks a destructive entry: red text, red hover.
  tone?: 'danger';
}

interface Props {
  // aria-label of the trigger: says which object the menu acts on.
  label: string;
  // Look and placement of the glyph, which stay with the caller — the header
  // menu and the per-variation one are deliberately not the same weight.
  className?: string;
  actions: Action[];
}

// Presentational: the dots, the floating list, and the rule that picking an
// entry closes the menu first. Right-anchored so it stays inside the panel.
export default function ActionMenu({
  label,
  className,
  actions,
}: Props) {
  return (
    <Popover
      align="end"
      trigger={
        <svg
          className={className}
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-label={label}
        >
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      }
    >
      {(close) => (
        <div className={styles.menu}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`${styles.option} ${
                action.tone === 'danger' ? styles.danger : ''
              }`}
              onClick={() => {
                close();
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
