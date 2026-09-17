import { useEffect, useState } from 'react';
import type { Route } from '@/routes/routes';
import { IdeasProvider } from '@/hooks/IdeasProvider';
import { useSession } from '@/hooks/useSession';
import ListScreen from '@/screens/ListScreen';
import DetailScreen from '@/screens/DetailScreen';
import SignInScreen from '@/screens/SignInScreen';
import Spinner from '@/components/Spinner/Spinner';
import styles from './App.module.css';

// Both panes are always rendered; which one is on screen is a CSS question,
// answered by the panel's own width. Nothing here knows the threshold — adding
// a matchMedia would put it in two languages at once.
export default function App() {
  const [route, setRoute] = useState<Route>({ selectedId: null });
  const { connected, checking } = useSession();

  // The indicator holds back before showing itself. The worker usually answers
  // in a few dozen milliseconds, and something that blinks on every opening of
  // the panel is worse than the blank it replaces; past this delay the wait is
  // long enough that silence would read as a failure instead.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!checking) return;
    const timer = setTimeout(() => setSlow(true), 250);
    return () => clearTimeout(timer);
  }, [checking]);

  // Still nothing for a quick check: showing the sign-in screen first would
  // flash it at every opening, and it is the wrong guess for anyone signed in.
  if (checking)
    return slow ? (
      <div className={styles.wait} role="status">
        <Spinner className={styles.waitSpinner} />
        {/* Not decoration: under reduced motion the spinner is gone and this
            line is the whole indicator. */}
        <p className={styles.waitNote}>Vérification de ta session…</p>
      </div>
    ) : null;
  if (!connected) return <SignInScreen />;

  return (
    <IdeasProvider>
      <div
        className={`${styles.shell} ${
          route.selectedId === null ? '' : styles.selected
        }`}
      >
        <div className={styles.master}>
          <ListScreen
            navigate={setRoute}
            selectedId={route.selectedId}
          />
        </div>
        <div className={styles.detail}>
          {/* Keyed on the selection: a half-written reformulation must not
              follow the reader to the next idea. */}
          <DetailScreen
            key={route.selectedId ?? 'none'}
            navigate={setRoute}
            ideaId={route.selectedId}
          />
        </div>
      </div>
    </IdeasProvider>
  );
}
