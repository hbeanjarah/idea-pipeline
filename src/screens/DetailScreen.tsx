import type { Navigate } from '@/routes/routes';
import { useIdeas } from '@/hooks/useIdeas';
import Alert from '@/components/Alert/Alert';
import Composer from '@/components/Composer/Composer';
import IdeaHeader from '@/components/IdeaHeader/IdeaHeader';
import StatusPicker from '@/components/StatusPicker/StatusPicker';
import VariationThread from '@/components/VariationThread/VariationThread';
import { failureText } from '@/lib/failureText';
import styles from './DetailScreen.module.css';

interface Props {
  navigate: Navigate;
  ideaId: string;
}

// Data via the hook only — never the repository. The idea is looked up in the
// in-memory list; everything below is presentational and receives callbacks.
export default function DetailScreen({ navigate, ideaId }: Props) {
  const {
    ideas,
    loading,
    addVariation,
    editVariation,
    changeStatus,
    deleteIdea,
    failure,
    retry,
  } = useIdeas();

  // A 404 here means the idea is gone from under us; the list has already been
  // reloaded and the screen falls back to its missing-idea branch.
  const shown = failure && failure.reason !== 'gone' ? failure : null;
  const idea = ideas.find((candidate) => candidate.id === ideaId);

  const remove = async () => {
    await deleteIdea(ideaId);
    // Left only once the deletion is confirmed: navigating away on a failure
    // would claim the idea is gone when it is still there.
    navigate({ screen: 'list' });
  };

  return (
    <main className={styles.detail}>
      <IdeaHeader
        onBack={() => navigate({ screen: 'list' })}
        onDelete={
          !loading && idea
            ? () => void remove().catch(() => undefined)
            : undefined
        }
      />

      {!loading &&
        (idea ? (
          <div className={styles.body}>
            <StatusPicker
              status={idea.status}
              onChange={(status) =>
                void changeStatus(idea.id, status)
              }
            />

            <VariationThread
              variations={idea.variations}
              onEdit={(variationId, text) =>
                editVariation(idea.id, variationId, text)
              }
            />

            {/* Reformulation: a new variation appends, never edits — and leaves
                the status untouched. */}
            <div className={styles.reform}>
              <p className={styles.eyebrow}>Reformuler</p>
              <Composer
                onSubmit={(text) => addVariation(idea.id, text)}
              />
              {shown && (
                <Alert
                  title={failureText(shown).title}
                  onRetry={retry ?? undefined}
                >
                  {failureText(shown).body}
                </Alert>
              )}
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
