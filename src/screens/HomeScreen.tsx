import type { Navigate } from '../routes/routes';
import { useIdeas } from '../hooks/useIdeas';
import Composer from '../components/Composer/Composer';

interface Props {
  navigate: Navigate;
}

// Data access via the hook only — never the repository directly. The nav
// buttons are temporary, thrown away once the real navigation lands.
export default function HomeScreen({ navigate }: Props) {
  const { create } = useIdeas();

  return (
    <main>
      <h1>Accueil</h1>
      <Composer onSubmit={create} />
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
