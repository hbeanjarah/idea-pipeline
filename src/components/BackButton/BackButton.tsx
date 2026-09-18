import styles from './BackButton.module.css';

interface Props {
  onClick: () => void;
  className?: string;
}

export default function BackButton({ onClick, className }: Props) {
  return (
    <button
      type="button"
      className={`${styles.back} ${className ?? ''}`}
      aria-label="Retour à la liste"
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5" />
        <path d="M11 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
