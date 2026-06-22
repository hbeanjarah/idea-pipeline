import type { Navigate } from '../routes/routes';
import type { Status } from '../storage/types';
import { useIdeas } from '../hooks/useIdeas';
import Composer from '../components/Composer/Composer';
import IdeaCard from '../components/IdeaCard/IdeaCard';
import styles from './HomeScreen.module.css';

interface Props {
  navigate: Navigate;
}

const PREVIEW_LIMIT = 5;

// Mini-pipeline segments — Publié excluded, per the mockup. Provisional labels.
const PIPELINE_SEGMENTS: { status: Status; label: string }[] = [
  { status: 'captured', label: 'Capturé' },
  { status: 'maturing', label: 'Maturation' },
  { status: 'ready', label: 'Prêt' },
];

// Data access via the hook only — never the repository directly.
export default function HomeScreen({ navigate }: Props) {
  const { ideas, loading, create } = useIdeas();

  // Most recently active first; bounded preview, never scrolls.
  const recent = [...ideas]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, PREVIEW_LIMIT);

  const hasIdeas = ideas.length > 0;

  return (
    <main className={styles.home}>
      <p className={styles.title}>Mes idées</p>

      {!loading && hasIdeas && (
        <div className={styles.pipe}>
          {PIPELINE_SEGMENTS.map(({ status, label }) => (
            <span key={status} className={styles.seg}>
              <span className={`${styles.dot} ${styles[status]}`} />
              {label}{' '}
              <span className={styles.count}>
                {
                  ideas.filter((idea) => idea.status === status)
                    .length
                }
              </span>
            </span>
          ))}
        </div>
      )}

      <Composer onSubmit={create} autoFocus />
      <p className={styles.hint}>
        ⏎ enregistrer · ⇧⏎ retour à la ligne
      </p>

      {!loading &&
        (hasIdeas ? (
          <>
            <p className={styles.eyebrow}>Récentes</p>
            <div className={styles.cards}>
              {recent.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onClick={() =>
                    navigate({ screen: 'detail', ideaId: idea.id })
                  }
                />
              ))}
            </div>
            <button
              type="button"
              className={styles.more}
              onClick={() => navigate({ screen: 'list' })}
            >
              <span>Voir toutes mes idées</span>
              <span className={styles.moreCount}>{ideas.length}</span>
            </button>
          </>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyCue}>
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5" />
                <path d="M6 11l6-6 6 6" />
              </svg>
            </div>
            <p className={styles.emptyTitle}>
              Ta première idée commence ici.
            </p>
            <p className={styles.emptySub}>
              Tape-la dans le champ ci-dessus, ⏎ pour la garder. Elle
              apparaîtra dans cette liste.
            </p>
          </div>
        ))}
    </main>
  );
}
