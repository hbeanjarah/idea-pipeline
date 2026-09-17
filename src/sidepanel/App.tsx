import { useState } from 'react';
import type { Route } from '@/routes/routes';
import { IdeasProvider } from '@/hooks/IdeasProvider';
import { useSession } from '@/hooks/useSession';
import ListScreen from '@/screens/ListScreen';
import DetailScreen from '@/screens/DetailScreen';
import SignInScreen from '@/screens/SignInScreen';
import styles from './App.module.css';

// Both panes are always rendered; which one is on screen is a CSS question,
// answered by the panel's own width. Nothing here knows the threshold — adding
// a matchMedia would put it in two languages at once.
export default function App() {
  const [route, setRoute] = useState<Route>({ selectedId: null });
  const { connected, checking } = useSession();

  // Nothing while the worker is being asked: showing the sign-in screen first
  // would flash it on every panel opening.
  if (checking) return null;
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
