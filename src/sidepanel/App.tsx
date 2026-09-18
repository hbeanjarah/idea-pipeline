import { useEffect, useState } from 'react';
import type { Route } from '@/routes/routes';
import { IdeasProvider } from '@/hooks/IdeasProvider';
import { LabelsProvider } from '@/hooks/LabelsProvider';
import { useSession } from '@/hooks/useSession';
import LabelsScreen from '@/screens/LabelsScreen';
import ListScreen from '@/screens/ListScreen';
import DetailScreen from '@/screens/DetailScreen';
import SignInScreen from '@/screens/SignInScreen';
import Spinner from '@/components/Spinner/Spinner';
import styles from './App.module.css';

export default function App() {
  const [route, setRoute] = useState<Route>({
    screen: 'ideas',
    selectedId: null,
  });
  const { connected, checking } = useSession();

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

        <p className={styles.waitNote}>Vérification de ta session…</p>
      </div>
    ) : null;
  if (!connected) return <SignInScreen />;

  return (
    <LabelsProvider>
      <IdeasProvider>
        {route.screen === 'labels' && (
          <LabelsScreen
            onClose={() => setRoute({ ...route, screen: 'ideas' })}
          />
        )}
        <div
          className={[
            styles.shell,
            route.selectedId === null ? '' : styles.selected,
            route.screen === 'labels' ? styles.behind : '',
          ].join(' ')}
        >
          <div className={styles.master}>
            <ListScreen
              navigate={setRoute}
              selectedId={route.selectedId}
            />
          </div>
          <div className={styles.detail}>
            <DetailScreen
              key={route.selectedId ?? 'none'}
              navigate={setRoute}
              ideaId={route.selectedId}
            />
          </div>
        </div>
      </IdeasProvider>
    </LabelsProvider>
  );
}
