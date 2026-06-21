import type { Navigate } from '../routes/routes';

interface Props {
  navigate: Navigate;
}

// Skeleton surface. Temporary navigation buttons — thrown away once the real
// navigation lands in later lots.
export default function HomeScreen({ navigate }: Props) {
  return (
    <main>
      <h1>Accueil</h1>
      <button onClick={() => navigate({ screen: 'list' })}>
        Aller à la liste
      </button>
      <button
        onClick={() =>
          navigate({ screen: 'detail', ideaId: 'demo-id' })
        }
      >
        Aller au détail
      </button>
    </main>
  );
}
