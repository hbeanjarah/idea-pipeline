import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';

import Alert from '@/components/Alert/Alert';
import LabelRow from '@/components/LabelRow/LabelRow';
import { useIdeas } from '@/hooks/useIdeas';
import { useLabels } from '@/hooks/useLabels';
import { failureText } from '@/lib/failureText';
import type { Label } from '@/storage/types';
import styles from './LabelsScreen.module.css';

const consequence = (count: number): string => {
  if (count === 0) return "Aucune idée n'est à cette étape.";
  if (count === 1)
    return "1 idée n'aura plus d'étape. Elle n'est pas supprimée — tu pourras la reclasser.";

  return `${count} idées n'auront plus d'étape. Elles ne sont pas supprimées — tu pourras les reclasser.`;
};

interface Props {
  onClose: () => void;
}

interface Drag {
  id: string;
  // Where the pointer was when the row last settled into place.
  origin: number;
  offset: number;
  order: Label[];
}

export default function LabelsScreen({ onClose }: Props) {
  const { labels, failure, retry, create, rename, remove, reorder } =
    useLabels();
  const { ideas, forgetLabel } = useIdeas();

  const [drag, setDrag] = useState<Drag | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const shown = drag?.order ?? labels;

  const commitOrder = (order: Label[]) => {
    const ids = order.map((label) => label.id);
    if (ids.some((id, at) => labels[at]?.id !== id))
      void reorder(ids);
  };

  const move = (id: string, direction: -1 | 1) => {
    const at = labels.findIndex((label) => label.id === id);
    const to = at + direction;
    if (at === -1 || to < 0 || to >= labels.length) return;

    const next = [...labels];
    next.splice(to, 0, ...next.splice(at, 1));
    commitOrder(next);
  };

  const grab = (id: string) => (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    // Capturing on the grip routes every later pointer event to it, so the
    // handlers below can sit on the list and catch them as they bubble — no
    // document listeners to add and remove.
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id, origin: event.clientY, offset: 0, order: labels });
  };

  const follow = (event: PointerEvent<HTMLUListElement>) => {
    const list = listRef.current;
    if (!drag || !list) return;

    const at = drag.order.findIndex((label) => label.id === drag.id);
    const boxes = [...list.children].map((row) =>
      row.getBoundingClientRect(),
    );

    const over = boxes.findIndex(
      (box, index) =>
        index !== at &&
        event.clientY > box.top &&
        event.clientY < box.bottom,
    );

    if (over === -1) {
      setDrag({ ...drag, offset: event.clientY - drag.origin });
      return;
    }

    const order = [...drag.order];
    order.splice(over, 0, ...order.splice(at, 1));
    // origin resets with the row: the offset is measured from where it now
    // sits, not from where the drag started.
    setDrag({ ...drag, order, origin: event.clientY, offset: 0 });
  };

  const release = () => {
    if (!drag) return;
    const { order } = drag;
    setDrag(null);
    commitOrder(order);
  };

  const carried = (id: string) =>
    ideas.filter((idea) => idea.labelId === id).length;

  const confirmRemoval = (id: string) => {
    setConfirming(null);
    void remove(id).then(() => forgetLabel(id));
  };

  return (
    <main className={styles.screen}>
      <div className={styles.bar}>
        <p className={styles.title}>Étapes</p>
        <button
          type="button"
          className={styles.close}
          aria-label="Fermer"
          onClick={onClose}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <p className={styles.lead}>
        Une idée traverse les étapes que tu définis ici. Renomme-les,
        réordonne-les, retire ce qui ne te sert pas.
      </p>

      {failure && (
        <Alert
          title={failureText(failure, 'write').title}
          onRetry={retry ?? undefined}
        >
          {failureText(failure, 'write').body}
        </Alert>
      )}

      <ul
        className={styles.list}
        ref={listRef}
        onPointerMove={follow}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {shown.map((label, index) => (
          <li key={label.id}>
            <LabelRow
              label={label}
              first={index === 0}
              last={index === shown.length - 1}
              lifted={drag?.id === label.id}
              offset={drag?.id === label.id ? drag.offset : 0}
              onRename={(name) => void rename(label.id, name)}
              onMove={(direction) => move(label.id, direction)}
              onRemove={() => setConfirming(label.id)}
              onGrab={grab(label.id)}
            />

            {confirming === label.id && (
              <div className={styles.confirmation}>
                <span className={styles.what}>
                  Supprimer « {label.name} » ?
                </span>
                <p className={styles.consequence}>
                  {consequence(carried(label.id))}
                </p>
                <div className={styles.choices}>
                  <button
                    type="button"
                    className={styles.cancel}
                    onClick={() => setConfirming(null)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className={styles.confirm}
                    onClick={() => confirmRemoval(label.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {labels.length === 0 && (
        <p className={styles.empty}>
          Aucune étape. Tes idées restent libres — c'est un état
          parfaitement valable.
        </p>
      )}

      <button
        type="button"
        className={styles.add}
        onClick={() => void create('Nouvelle étape')}
      >
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Ajouter une étape
      </button>

      <p className={styles.note}>
        Renommer une étape ne change aucune idée.
      </p>
    </main>
  );
}
