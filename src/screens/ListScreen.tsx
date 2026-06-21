import type { Navigate } from '../routes/routes';

interface Props {
  navigate: Navigate;
}

// Skeleton surface. Temporary navigation buttons — thrown away once the real
// navigation lands in later lots.
export default function ListScreen({ navigate }: Props) {
  return (
    <main>
      <h1>Liste</h1>
      <button onClick={() => navigate({ screen: 'home' })}>Aller à l’accueil</button>
      <button onClick={() => navigate({ screen: 'detail', ideaId: 'demo-id' })}>
        Aller au détail
      </button>
    </main>
  );
}
