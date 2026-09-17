import { useState } from 'react';
import type { Navigate } from '@/routes/routes';
import { useIdeas } from '@/hooks/useIdeas';
import { useSession } from '@/hooks/useSession';
import { filterIdeas } from '@/lib/filterIdeas';
import type { FilterStatus } from '@/lib/filterIdeas';
import AccountMenu from '@/components/AccountMenu/AccountMenu';
import Alert from '@/components/Alert/Alert';
import CardSkeleton from '@/components/CardSkeleton/CardSkeleton';
import Composer from '@/components/Composer/Composer';
import IdeaCard from '@/components/IdeaCard/IdeaCard';
import StatusFilter from '@/components/StatusFilter/StatusFilter';
import SearchInput from '@/components/SearchInput/SearchInput';
import { failureText } from '@/lib/failureText';
import styles from './ListScreen.module.css';

interface Props {
  navigate: Navigate;
  // Which idea the detail pane is showing, so the list can mark it. Only
  // meaningful when both panes are on screen.
  selectedId: string | null;
}

// The master column: capture at the top, everything captured below. It absorbed
// the home screen, which held the same composer and a bounded preview of the
// same list — an entry hall in front of the room it opened onto.
//
// Reads two contexts, which a screen is allowed to do (react.md); the identity
// is only shown here.
export default function ListScreen({ navigate, selectedId }: Props) {
  const { ideas, pendingIds, loading, failure, retry, create } =
    useIdeas();
  const { user, signOut } = useSession();

  // A 404 is not shown here: the list has already been reloaded.
  const shown = failure && failure.reason !== 'gone' ? failure : null;
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

  // Filter (status + query) first, then sort: most recently active first.
  const visible = [...filterIdeas(ideas, { status, query })].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );

  const hasIdeas = ideas.length > 0;
  const searchTerm = query.trim();

  return (
    <main className={styles.list}>
      <div className={styles.bar}>
        <p className={styles.title}>Mes idées</p>
        <AccountMenu
          email={user?.email ?? null}
          onSignOut={() => void signOut()}
        />
      </div>

      <Composer onSubmit={create} autoFocus />
      <p className={styles.hint}>
        ⏎ enregistrer · ⇧⏎ retour à la ligne · - puce
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
          <SearchInput value={query} onChange={setQuery} />
          <StatusFilter
            active={status}
            counts={counts}
            onChange={setStatus}
          />
        </>
      )}

      {/* The rows box stays mounted through the load, so the skeletons and the
          real cards land in the same place. */}
      <div className={styles.rows}>
        {loading ? (
          <CardSkeleton count={4} />
        ) : !hasIdeas ? (
          // Only when nothing failed: while an alert is showing, the list is
          // unknown rather than empty, and inviting a first idea would claim
          // the account has none.
          !shown && (
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
          )
        ) : visible.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyNote}>
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
              pending={pendingIds.has(idea.id)}
              selected={idea.id === selectedId}
              onClick={() => navigate({ selectedId: idea.id })}
            />
          ))
        )}
      </div>
    </main>
  );
}
