// Single source of truth for "where we are". No router (Side Panel: no URL,
// no deep-link). App.tsx is the only place that maps a Route to a screen.

export type Route = { screen: 'home' } | { screen: 'list' } | { screen: 'detail'; ideaId: string };

// One typed argument: the discriminated union forces completeness — reaching
// 'detail' without an ideaId is a compile error.
export type Navigate = (route: Route) => void;
