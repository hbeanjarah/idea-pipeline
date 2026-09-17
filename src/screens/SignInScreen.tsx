import { useState } from 'react';
import { useSession } from '@/hooks/useSession';
import Spinner from '@/components/Spinner/Spinner';
import Alert from '@/components/Alert/Alert';
import { failureText } from '@/lib/failureText';
import styles from './SignInScreen.module.css';

export default function SignInScreen() {
  const { signIn, signInFailure, signOutIncomplete } = useSession();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signIn();
    } finally {
      setBusy(false);
    }
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
      <button
        className={styles.button}
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? (
          <Spinner />
        ) : (
          /* These four colors are Google's own and are not project tokens —
             they must not be swapped for one. */
          <svg
            className={styles.googleMark}
            viewBox="0 0 48 48"
            width="17"
            height="17"
            aria-hidden="true"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
        )}
        {busy ? 'Connexion en cours…' : 'Se connecter avec Google'}
      </button>
      {signInFailure && (
        <div className={styles.notice}>
          <Alert
            title={failureText(signInFailure, 'signIn').title}
            onRetry={() => void submit()}
          >
            {failureText(signInFailure, 'signIn').body}
          </Alert>
        </div>
      )}

      {/* Not a failure of this screen, but of the sign-out that led here: the
          session is still alive on the server and the user should know. */}
      {signOutIncomplete && (
        <div className={styles.notice}>
          <Alert title="Déconnexion incomplète">
            Cet appareil est déconnecté, mais le serveur n&rsquo;a pas
            pu être prévenu. La session restera ouverte à distance
            jusqu&rsquo;à son expiration.
          </Alert>
        </div>
      )}

      <p className={styles.legal}>
        Aucun mot de passe n&rsquo;est stocké. Tu peux déconnecter cet
        appareil à tout moment.
      </p>
    </main>
  );
}
