import { useState } from 'react';
import { useSession } from '../hooks/useSession';
import styles from './SignInScreen.module.css';

// Temporary: this brick pastes a token by hand. The Google brick replaces this
// form — and only this form — with launchWebAuthFlow.
export default function SignInScreen() {
  const { signIn } = useSession();
  const [token, setToken] = useState('');

  const submit = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    await signIn(trimmed);
  };

  return (
    <main className={styles.signIn}>
      <div className={styles.mark}>
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5" />
          <path d="M6 11l6-6 6 6" />
        </svg>
      </div>
      <h1 className={styles.title}>
        Tes idées, sur tous tes navigateurs
      </h1>
      <p className={styles.lead}>
        Connecte-toi pour retrouver ton pipeline ici et ailleurs.
      </p>
      <input
        id="session-token"
        className={styles.field}
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="Colle ton jeton de session"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        className={styles.button}
        type="button"
        onClick={() => void submit()}
      >
        Se connecter
      </button>
      <p className={styles.legal}>
        Étape provisoire : la connexion Google arrive avec la brique
        suivante.
      </p>
    </main>
  );
}
