import { useState } from 'react';
import type { Route } from '../routes/routes';
import HomeScreen from '../screens/HomeScreen';
import ListScreen from '../screens/ListScreen';
import DetailScreen from '../screens/DetailScreen';

// The only place that maps a Route to a screen. Screens never read the route
// state directly — they receive navigate (and their params) as props.
export default function App() {
  const [route, setRoute] = useState<Route>({ screen: 'home' });

  switch (route.screen) {
    case 'home':
      return <HomeScreen navigate={setRoute} />;
    case 'list':
      return <ListScreen navigate={setRoute} />;
    case 'detail':
      return <DetailScreen navigate={setRoute} ideaId={route.ideaId} />;
  }
}
