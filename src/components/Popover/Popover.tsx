import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Popover.module.css';

interface Props {
  // The clickable trigger content. Popover wraps it in a reset <button>.
  trigger: ReactNode;
  // Which edge the floating content aligns to. 'start' (default) anchors left;
  // 'end' anchors right, for a trigger sitting at the right of its row.
  align?: 'start' | 'end';
  // Render-prop: receives close() so an item can dismiss after acting.
  children: (close: () => void) => ReactNode;
}

// Behavioral + presentational primitive — no business logic. Opens on trigger
// click, closes on outside click and Escape. "Only one open at a time" comes
// for free from outside-click: clicking another trigger is outside this one,
// so it closes — no global registry needed.
export default function Popover({
  trigger,
  align = 'start',
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape listeners live only while open, with cleanup. A
  // click inside the container (trigger or content) must not close it.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={containerRef} className={styles.popover}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((previous) => !previous)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`${styles.content} ${align === 'end' ? styles.end : ''}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
