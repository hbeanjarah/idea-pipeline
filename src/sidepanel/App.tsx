import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Route } from '../routes/routes';
import { IdeasProvider } from '../hooks/IdeasProvider';
import HomeScreen from '../screens/HomeScreen';
import ListScreen from '../screens/ListScreen';
import DetailScreen from '../screens/DetailScreen';

// The only place that maps a Route to a screen. Screens never read the route
// state directly — they receive navigate (and their params) as props.
// IdeasProvider is mounted once here, wrapping every screen.
export default function App() {
  const [route, setRoute] = useState<Route>({ screen: 'home' });

  let screen: ReactNode;
  switch (route.screen) {
    case 'home':
      screen = <HomeScreen navigate={setRoute} />;
      break;
    case 'list':
      screen = <ListScreen navigate={setRoute} />;
      break;
    case 'detail':
      screen = (
        <DetailScreen navigate={setRoute} ideaId={route.ideaId} />
      );
      break;
  }

  return <IdeasProvider>{screen}</IdeasProvider>;
}
