import { useState } from 'react';
import type { Navigate } from '../routes/routes';
import { useIdeas } from '../hooks/useIdeas';
import { filterIdeas } from '../lib/filterIdeas';
import type { FilterStatus } from '../lib/filterIdeas';
import IdeaCard from '../components/IdeaCard/IdeaCard';
import StatusFilter from '../components/StatusFilter/StatusFilter';
import SearchInput from '../components/SearchInput/SearchInput';
import styles from './ListScreen.module.css';

interface Props {
  navigate: Navigate;
}

// Data access via the hook only — never the repository directly. Read-only here;
// the active filter is local UI state, applied in memory via the pure filterIdeas.
export default function ListScreen({ navigate }: Props) {
  const { ideas, loading } = useIdeas();
  const [status, setStatus] = useState<FilterStatus>('all');
  const [query, setQuery] = useState('');

  // Counts run on the full list, independent of the active filter — otherwise
  // every non-active counter would drop to 0.
  const counts: Record<FilterStatus, number> = {
    all: ideas.length,
    captured: 0,
    maturing: 0,
    ready: 0,
    published: 0,
  };
  for (const idea of ideas) counts[idea.status]++;

  // Filter (status + query) first, then sort: most recently active first, like
  // the Home preview.
  const visible = [...filterIdeas(ideas, { status, query })].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );

  const hasIdeas = ideas.length > 0;
  const searchTerm = query.trim();

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

      {!loading && hasIdeas && (
        <>
          <SearchInput value={query} onChange={setQuery} />
          <StatusFilter
            active={status}
            counts={counts}
            onChange={setStatus}
          />
        </>
      )}

      {!loading && (
        <div className={styles.rows}>
          {!hasIdeas ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                Aucune idée pour l'instant.
              </p>
              <p className={styles.emptySub}>
                Reviens à l'accueil pour capturer ta première idée.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {searchTerm
                  ? `Aucune idée ne contient « ${searchTerm} ».`
                  : 'Aucune idée à cette étape.'}
              </p>
            </div>
          ) : (
            visible.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onClick={() =>
                  navigate({ screen: 'detail', ideaId: idea.id })
                }
              />
            ))
          )}
        </div>
      )}
    </main>
  );
}
