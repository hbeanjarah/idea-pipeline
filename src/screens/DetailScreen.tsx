import type { Navigate } from '../routes/routes';

interface Props {
  navigate: Navigate;
  ideaId: string;
}

// Skeleton surface. Shows the raw ideaId so the param is actually consumed.
// Temporary navigation buttons — thrown away once the real navigation lands.
export default function DetailScreen({ navigate, ideaId }: Props) {
  return (
    <main>
      <h1>Détail</h1>
      <p>ideaId : {ideaId}</p>
      <button onClick={() => navigate({ screen: 'home' })}>
        Aller à l’accueil
      </button>
      <button onClick={() => navigate({ screen: 'list' })}>
        Aller à la liste
      </button>
    </main>
  );
}
