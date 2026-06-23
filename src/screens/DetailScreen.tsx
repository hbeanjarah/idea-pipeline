import { useState } from 'react';
import type { Navigate } from '../routes/routes';
import type { Status } from '../storage/types';
import { useIdeas } from '../hooks/useIdeas';
import Composer from '../components/Composer/Composer';
import Popover from '../components/Popover/Popover';
import VariationEditor from '../components/VariationEditor/VariationEditor';
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

// Pipeline order for the status picker. Transitions are free: any step is
// reachable from any step (no enforced sequence).
const STATUS_ORDER: Status[] = [
  'captured',
  'maturing',
  'ready',
  'published',
];

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
  const {
    ideas,
    loading,
    addVariation,
    editVariation,
    changeStatus,
    deleteIdea,
  } = useIdeas();
  const idea = ideas.find((candidate) => candidate.id === ideaId);
  // Two-step inline delete guard: the bar only shows after the menu entry.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Which variation is being edited inline (null = none).
  const [editingVariationId, setEditingVariationId] = useState<
    string | null
  >(null);

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

        {/* Idea actions hub (⋮) — today a single entry (delete). Right-anchored
            popover so the menu stays inside the panel. Only when an idea is
            loaded: there is nothing to act on otherwise. */}
        {!loading && idea && (
          <Popover
            align="end"
            trigger={
              <svg
                className={styles.menuIcon}
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-label="Actions de l'idée"
              >
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            }
          >
            {(close) => (
              <div className={styles.actionMenu}>
                <button
                  type="button"
                  className={styles.deleteOption}
                  onClick={() => {
                    close();
                    setConfirmingDelete(true);
                  }}
                >
                  Supprimer l&rsquo;idée
                </button>
              </div>
            )}
          </Popover>
        )}
      </div>

      {/* Inline two-step confirmation, pinned under the header. Delete is only
          run on the second click; deletion is permanent (no trash). */}
      {!loading && idea && confirmingDelete && (
        <div className={styles.confirmBar}>
          <span className={styles.confirmText}>
            Supprimer cette idée définitivement&nbsp;?
          </span>
          <button
            type="button"
            className={styles.confirmCancel}
            onClick={() => setConfirmingDelete(false)}
          >
            Annuler
          </button>
          <button
            type="button"
            className={styles.confirmDelete}
            onClick={() => {
              void deleteIdea(idea.id);
              navigate({ screen: 'list' });
            }}
          >
            Supprimer
          </button>
        </div>
      )}

      {!loading &&
        (idea ? (
          <div className={styles.body}>
            {/* The status badge is the trigger: clicking it opens a popover
                listing the 4 steps. Transitions are free; selecting one runs
                changeStatus only when it actually changes, but always closes. */}
            <div className={styles.status}>
              <Popover
                trigger={
                  <span className={styles.badge}>
                    <span
                      className={`${styles.dot} ${styles[idea.status]}`}
                    />
                    {STATUS_LABELS[idea.status]}
                    <svg
                      className={styles.chevron}
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                }
              >
                {(close) => (
                  <div className={styles.statusMenu}>
                    {STATUS_ORDER.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={styles.statusOption}
                        onClick={() => {
                          if (status !== idea.status) {
                            void changeStatus(idea.id, status);
                          }
                          close();
                        }}
                      >
                        <span
                          className={`${styles.dot} ${styles[status]}`}
                        />
                        {STATUS_LABELS[status]}
                        {status === idea.status && (
                          <svg
                            className={styles.check}
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </Popover>
            </div>

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
                  {editingVariationId === variation.id ? (
                    // Editing in place: editVariation fixes the text, never
                    // adds a version. The first variation uses this same path.
                    <VariationEditor
                      initialText={variation.text}
                      onSave={(text) => {
                        void editVariation(
                          idea.id,
                          variation.id,
                          text,
                        );
                        setEditingVariationId(null);
                      }}
                      onCancel={() => setEditingVariationId(null)}
                    />
                  ) : (
                    <>
                      <div className={styles.verHead}>
                        <p className={styles.text}>
                          {variation.text}
                        </p>
                        {/* ⋮ variation-actions: always visible but faint,
                            darkens on hover. Today a single entry (edit). */}
                        <Popover
                          align="end"
                          trigger={
                            <svg
                              className={styles.verMenu}
                              viewBox="0 0 24 24"
                              width="16"
                              height="16"
                              fill="currentColor"
                              aria-label="Actions de la variation"
                            >
                              <circle cx="5" cy="12" r="1.6" />
                              <circle cx="12" cy="12" r="1.6" />
                              <circle cx="19" cy="12" r="1.6" />
                            </svg>
                          }
                        >
                          {(close) => (
                            <div className={styles.actionMenu}>
                              <button
                                type="button"
                                className={styles.editOption}
                                onClick={() => {
                                  close();
                                  setEditingVariationId(variation.id);
                                }}
                              >
                                Modifier
                              </button>
                            </div>
                          )}
                        </Popover>
                      </div>
                      <span className={styles.date}>
                        {formatTimestamp(variation.createdAt)}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Reformulation: the Composer is reused as-is (single onSubmit
                prop). A new variation appends, never edits — and leaves the
                status untouched. */}
            <div className={styles.reform}>
              <p className={styles.eyebrow}>Reformuler</p>
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
