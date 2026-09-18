// Pas de routeur : le Side Panel n'a ni URL ni lien profond, un routeur
// n'apporterait rien.
//
// selectedId voyage avec les deux surfaces : partir gérer ses étapes puis
// revenir ne doit pas perdre l'idée qu'on était en train de lire.
export type Route = {
  screen: 'ideas' | 'labels';
  selectedId: string | null;
};

export type Navigate = (route: Route) => void;
