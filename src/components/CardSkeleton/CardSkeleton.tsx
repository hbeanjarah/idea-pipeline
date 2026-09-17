import styles from './CardSkeleton.module.css';

interface Props {
  count: number;
}

// Siblings rather than a wrapper, so the list's own gap spaces them like real
// cards instead of a second gap having to match it.
// aria-hidden: announcing four empty cards while waiting is worse than silence.
export default function CardSkeleton({ count }: Props) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.card} aria-hidden="true">
          <span className={styles.line} />
          <span className={styles.meta} />
        </div>
      ))}
    </>
  );
}
