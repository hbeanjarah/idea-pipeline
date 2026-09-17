import type { Navigate } from '@/routes/routes';
import type { Status } from '@/storage/types';
import { useIdeas } from '@/hooks/useIdeas';
import { useSession } from '@/hooks/useSession';
import AccountMenu from '@/components/AccountMenu/AccountMenu';
import Alert from '@/components/Alert/Alert';
import Composer from '@/components/Composer/Composer';
import IdeaCard from '@/components/IdeaCard/IdeaCard';
import { failureText } from '@/lib/failureText';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/statusLabels';
import styles from './HomeScreen.module.css';

interface Props {
  navigate: Navigate;
}

const PREVIEW_LIMIT = 5;

// Mini-pipeline segments — Publié excluded, per the mockup.
const PIPELINE_SEGMENTS: { status: Status; label: string }[] =
  STATUS_ORDER.filter((status) => status !== 'published').map(
    (status) => ({ status, label: STATUS_LABELS[status] }),
  );

// Data access via the hook only — never the repository directly.
export default function HomeScreen({ navigate }: Props) {
  const { ideas, loading, failure, retry, create } = useIdeas();
  const { user, signOut } = useSession();

  // A 404 is not shown here: the list has already been reloaded, there is
  // nothing for the user to act on.
  const shown = failure && failure.reason !== 'gone' ? failure : null;

  // Most recently active first; bounded preview, never scrolls.
  const recent = [...ideas]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, PREVIEW_LIMIT);

  const hasIdeas = ideas.length > 0;

  return (
    <main className={styles.home}>
      <div className={styles.titlebar}>
        <p className={styles.title}>Mes idées</p>
        <AccountMenu
          email={user?.email ?? null}
          onSignOut={() => void signOut()}
        />
      </div>

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

      {shown && (
        <Alert
          title={failureText(shown, 'read').title}
          onRetry={retry ?? undefined}
        >
          {failureText(shown, 'read').body}
        </Alert>
      )}

      {!loading && hasIdeas && (
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
            <span>Toutes mes idées</span>
            <span className={styles.moreCount}>{ideas.length}</span>
          </button>
        </>
      )}

      {/* Only when nothing failed: while an alert is showing the list is
          unknown rather than empty, and inviting a first idea would claim the
          account has none. */}
      {!loading && !hasIdeas && !shown && (
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
        </div>
      )}
    </main>
  );
}
