import type { ChangeEvent } from 'react';
import styles from './SearchInput.module.css';

// Provisional placeholder; microcopy is finalized in the last lot.
const PLACEHOLDER = 'Rechercher…';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

// Presentational only: a controlled text field. Knows nothing of useIdeas, the
// repository or how the query is used.
export default function SearchInput({ value, onChange }: Props) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={styles.search}>
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4-4" />
      </svg>
      <input
        type="search"
        className={styles.input}
        value={value}
        placeholder={PLACEHOLDER}
        onChange={handleChange}
      />
    </div>
  );
}
