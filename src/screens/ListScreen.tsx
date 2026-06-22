import type { Navigate } from '../routes/routes';
import { useIdeas } from '../hooks/useIdeas';
import IdeaCard from '../components/IdeaCard/IdeaCard';
import styles from './ListScreen.module.css';

interface Props {
  navigate: Navigate;
}

// Data access via the hook only — never the repository directly. Read-only here:
// the full list, sorted like the Home preview. Filters / search land in later lots.
export default function ListScreen({ navigate }: Props) {
  const { ideas, loading } = useIdeas();

  // Most recently active first — consistent with the Home preview, but unbounded.
  const sorted = [...ideas].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  const hasIdeas = ideas.length > 0;

  return (
    <main className={styles.list}>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate({ screen: 'home' })}
          aria-label="Retour à l'accueil"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M11 19l-7-7 7-7" />
          </svg>
        </button>
        <p className={styles.title}>Mes idées</p>
      </div>

      {!loading && (
        <div className={styles.rows}>
          {hasIdeas ? (
            sorted.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onClick={() =>
                  navigate({ screen: 'detail', ideaId: idea.id })
                }
              />
            ))
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                Aucune idée pour l'instant.
              </p>
              <p className={styles.emptySub}>
                Reviens à l'accueil pour capturer ta première idée.
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
