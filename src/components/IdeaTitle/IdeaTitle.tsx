import styles from './IdeaTitle.module.css';

interface Props {
  title: string | null;
}

export default function IdeaTitle({ title }: Props) {
  if (title === null) return null;

  return <p className={styles.line}>{title}</p>;
}
