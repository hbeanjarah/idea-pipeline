import type { Navigate } from '../routes/routes';
import type { Status } from '../storage/types';
import { useIdeas } from '../hooks/useIdeas';
import Composer from '../components/Composer/Composer';
import styles from './DetailScreen.module.css';

interface Props {
  navigate: Navigate;
  ideaId: string;
}

// Provisional labels, kept in sync with the rest of the app (Home pipeline,
// StatusFilter). A shared label map would be a separate refactor — out of scope.
const STATUS_LABELS: Record<Status, string> = {
  captured: 'Capturé',
  maturing: 'Maturation',
  ready: 'Prêt',
  published: 'Publié',
};

// ISO 8601 -> readable timestamp with time (mono metadata in the UI).
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Read-only here. Data via the hook only — never the repository. The idea is
// looked up in the in-memory list; mutations (reformulate / status / delete)
// land on this structure in the next lots.
export default function DetailScreen({ navigate, ideaId }: Props) {
  const { ideas, loading, addVariation } = useIdeas();
  const idea = ideas.find((candidate) => candidate.id === ideaId);

  return (
    <main className={styles.detail}>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate({ screen: 'list' })}
          aria-label="Retour à la liste"
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
      </div>

      {!loading &&
        (idea ? (
          <div className={styles.body}>
            <p className={styles.status}>
              <span
                className={`${styles.dot} ${styles[idea.status]}`}
              />
              {STATUS_LABELS[idea.status]}
            </p>

            <div className={styles.thread}>
              {idea.variations.map((variation, index) => (
                <div
                  key={variation.id}
                  className={`${styles.ver} ${
                    index === idea.variations.length - 1
                      ? styles.current
                      : ''
                  }`}
                >
                  <p className={styles.text}>{variation.text}</p>
                  <span className={styles.date}>
                    {formatTimestamp(variation.createdAt)}
                  </span>
                </div>
              ))}
            </div>

            {/* Reformulation: the Composer is reused as-is (single onSubmit
                prop). A new variation appends, never edits — and leaves the
                status untouched. */}
            <div className={styles.reform}>
              <Composer
                onSubmit={(text) => addVariation(idea.id, text)}
              />
            </div>
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Idée introuvable.</p>
              <button
                type="button"
                className={styles.emptyBack}
                onClick={() => navigate({ screen: 'list' })}
              >
                Retour à la liste
              </button>
            </div>
          </div>
        ))}
    </main>
  );
}
