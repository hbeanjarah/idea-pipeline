import styles from './Spinner.module.css';

interface Props {
  // Announced when the spinner appears. Left out where something else already
  // says what is happening, which is the common case: the spinner then carries
  // no information a screen reader could use.
  label?: string;
  // Size and placement stay with the caller, as they do for ActionMenu's glyph.
  className?: string;
}

export default function Spinner({ label, className }: Props) {
  return (
    <span
      className={`${styles.spinner} ${className ?? ''}`}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
