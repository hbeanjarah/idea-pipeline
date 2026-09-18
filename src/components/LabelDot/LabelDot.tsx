import styles from './LabelDot.module.css';

interface Props {
  // The stage's palette slot, or null for an idea with no stage.
  color: number | null;
}

// Decorative: the stage's name sits next to it in every caller, so the dot
// carries nothing a screen reader would need.
export default function LabelDot({ color }: Props) {
  const tone =
    color === null ? styles.hollow : (styles[`l${color}`] ?? '');

  return (
    <span className={`${styles.dot} ${tone}`} aria-hidden="true" />
  );
}
