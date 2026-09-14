import styles from './Avatar.module.css';

interface Props {
  // null while the identity has not come back.
  email: string | null;
  // Given only when the avatar is the whole content of a control: a single
  // letter is not a name anyone can act on.
  label?: string;
}

export default function Avatar({ email, label }: Props) {
  const initial = email?.trim().charAt(0).toUpperCase() ?? '';

  return (
    <span
      className={`${styles.avatar} ${email === null ? styles.waiting : ''}`}
      {...(label === undefined
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label })}
    >
      {initial}
    </span>
  );
}
