// Pas de routeur : le Side Panel n'a ni URL ni lien profond, un routeur
// n'apporterait rien.
export type Route = { selectedId: string | null };

export type Navigate = (route: Route) => void;
