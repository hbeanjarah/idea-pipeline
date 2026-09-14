import styles from './Alert.module.css';

interface Props {
  title: string;
  children: string;
  onRetry?: () => void;
}

// Sits below the field it concerns, never over it: a modal would steal the
// focus and the place the user was at, which is what the kept text protects.
export default function Alert({ title, children, onRetry }: Props) {
  return (
    <div className={styles.alert} role="alert">
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16.5v.5" />
      </svg>
      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        {children}
        {onRetry && (
          <button
            className={styles.retry}
            type="button"
            onClick={onRetry}
          >
            <svg
              className={styles.retryIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 12a8 8 0 1 1-2.3-5.7" />
              <path d="M20 4v4h-4" />
            </svg>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
