import { useState } from 'react';
import type { Navigate } from '@/routes/routes';
import { useIdeas } from '@/hooks/useIdeas';
import { useLabels } from '@/hooks/useLabels';
import Alert from '@/components/Alert/Alert';
import CurrentVersion from '@/components/CurrentVersion/CurrentVersion';
import IdeaHeader from '@/components/IdeaHeader/IdeaHeader';
import LabelPicker from '@/components/LabelPicker/LabelPicker';
import VariationEditor from '@/components/VariationEditor/VariationEditor';
import VariationThread from '@/components/VariationThread/VariationThread';
import { failureText } from '@/lib/failureText';
import {
  currentVariation,
  isMeaningfulDraft,
  previousVariations,
} from '@/lib/variations';
import styles from './DetailScreen.module.css';

interface Props {
  navigate: Navigate;

  ideaId: string | null;
}

export default function DetailScreen({ navigate, ideaId }: Props) {
  const {
    ideas,
    loading,
    addVariation,
    editVariation,
    setLabel,
    deleteIdea,
    failure,
    retry,
  } = useIdeas();
  const { labels } = useLabels();

  // A 404 here means the idea is gone from under us; the list has already been
  // reloaded and the screen falls back to its missing-idea branch.
  const shown = failure && failure.reason !== 'gone' ? failure : null;

  // The reformulation draft: null when closed, otherwise the text it opened
  // with. App keys this screen on the selection, so switching ideas drops it.
  const [draft, setDraft] = useState<string | null>(null);
  const idea =
    ideaId === null
      ? undefined
      : ideas.find((candidate) => candidate.id === ideaId);

  const remove = async (id: string) => {
    await deleteIdea(id);
    // Left only once the deletion is confirmed: navigating away on a failure
    // would claim the idea is gone when it is still there.
    navigate({ screen: 'ideas', selectedId: null });
  };

  return (
    <main className={styles.detail}>
      <IdeaHeader
        onBack={() => navigate({ screen: 'ideas', selectedId: null })}
        onDelete={
          !loading && idea
            ? () => void remove(idea.id).catch(() => undefined)
            : undefined
        }
      />

      {!loading &&
        (idea ? (
          <div className={styles.body}>
            <LabelPicker
              className={styles.stage}
              labels={labels}
              labelId={idea.labelId}
              onChange={(labelId) => void setLabel(idea.id, labelId)}
              onManage={() =>
                navigate({ screen: 'labels', selectedId: idea.id })
              }
            />

            <CurrentVersion
              variation={currentVariation(idea)}
              onFix={(text) =>
                editVariation(
                  idea.id,
                  currentVariation(idea).id,
                  text,
                )
              }
            />

            {/* Reformulating appends a version, never edits one, and leaves the
                status untouched. The draft starts from the current text: a new
                version is almost always a retouch, and retyping the whole idea
                is what made it cost as much as capturing a new one. */}
            {draft === null ? (
              <button
                type="button"
                className={styles.reformulate}
                onClick={() => setDraft(currentVariation(idea).text)}
              >
                Reformuler
              </button>
            ) : (
              <div className={styles.draft}>
                <VariationEditor
                  // Changing the key is what resets the editor to a blank
                  // page: it copies initialText once, on mount.
                  key={draft === '' ? 'blank' : 'filled'}
                  initialText={draft}
                  onSave={async (text) => {
                    if (
                      isMeaningfulDraft(
                        text,
                        currentVariation(idea).text,
                      )
                    ) {
                      await addVariation(idea.id, text);
                    }
                    setDraft(null);
                  }}
                  onCancel={() => setDraft(null)}
                />
                {draft !== '' && (
                  <button
                    type="button"
                    className={styles.blank}
                    onClick={() => setDraft('')}
                  >
                    Repartir d&rsquo;une page blanche
                  </button>
                )}
              </div>
            )}

            {shown && (
              <Alert
                title={failureText(shown, 'write').title}
                onRetry={retry ?? undefined}
              >
                {failureText(shown, 'write').body}
              </Alert>
            )}

            {previousVariations(idea).length > 0 && (
              <div className={styles.history}>
                <p className={styles.eyebrow}>Versions précédentes</p>
                <VariationThread
                  variations={previousVariations(idea)}
                  onEdit={(variationId, text) =>
                    editVariation(idea.id, variationId, text)
                  }
                />
              </div>
            )}
          </div>
        ) : ideaId === null ? (
          // Wide panel, nothing chosen yet. Not a failure — an invitation, and
          // the only state this pane has that the narrow layout never shows.
          <div className={styles.body}>
            <div className={styles.empty}>
              <p className={styles.emptyNote}>
                Choisis une idée à faire mûrir.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Idée introuvable.</p>
              <button
                type="button"
                className={styles.emptyBack}
                onClick={() =>
                  navigate({ screen: 'ideas', selectedId: null })
                }
              >
                Retour à la liste
              </button>
            </div>
          </div>
        ))}
    </main>
  );
}
