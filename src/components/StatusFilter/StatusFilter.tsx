import type { FilterStatus } from '../../lib/filterIdeas';
import styles from './StatusFilter.module.css';

interface Props {
  active: FilterStatus;
  counts: Record<FilterStatus, number>;
  onChange: (status: FilterStatus) => void;
}

// Provisional labels. Same status keeps the same label everywhere (cf. Home pipeline).
const SEGMENTS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'captured', label: 'Capturé' },
  { value: 'maturing', label: 'Maturation' },
  { value: 'ready', label: 'Prêt' },
  { value: 'published', label: 'Publié' },
];

// Presentational only: receives the active filter, the per-segment counts and a
// callback. Knows nothing of useIdeas or the repository.
export default function StatusFilter({
  active,
  counts,
  onChange,
}: Props) {
  return (
    <div className={styles.filters}>
      {SEGMENTS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={`${styles.pill} ${active === value ? styles.on : ''}`}
          onClick={() => onChange(value)}
        >
          {label}
          <span className={styles.count}>{counts[value]}</span>
        </button>
      ))}
    </div>
  );
}
