// LinkedIn's composer has no list markup and renders neither Markdown nor HTML:
// a bullet there is the character itself, typed at the start of the line. So
// what is written here is already what gets published — nothing to convert on
// the way out, and nothing new to store.
export const BULLET = '• ';

// A native edit rather than a new string: applyEdit replays it through the
// browser so the undo stack survives.
export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

const lineStart = (text: string, caret: number): number =>
  text.lastIndexOf('\n', caret - 1) + 1;

const startBullet = (
  text: string,
  caret: number,
): TextEdit | null => {
  const typed = text.slice(lineStart(text, caret), caret);
  if (typed !== '-' && typed !== '*') return null;
  return { from: lineStart(text, caret), to: caret, insert: BULLET };
};

const continueBullet = (
  text: string,
  caret: number,
): TextEdit | null => {
  const start = lineStart(text, caret);
  const line = text.slice(start, caret);
  if (!line.startsWith(BULLET)) return null;
  // Nothing but the bullet: end the list instead of growing an empty item.
  if (line === BULLET) return { from: start, to: caret, insert: '' };
  return { from: caret, to: caret, insert: `\n${BULLET}` };
};

// The two gestures that build a list, read from the keystroke alone. Returns
// null for everything else, which is then left to the browser.
export function bulletEdit(
  key: string,
  text: string,
  from: number,
  to: number,
): TextEdit | null {
  // A selection means the keystroke replaces something; rewriting the line
  // under it would throw that away.
  if (from !== to) return null;
  if (key === 'Enter') return continueBullet(text, from);
  if (key === ' ') return startBullet(text, from);
  return null;
}

// execCommand is deprecated, and it is still the only way to write into a
// textarea without flattening the browser's undo stack — setting React state
// instead would make Ctrl+Z step over the bullet, or past it. The target is
// Chrome only, where it works.
export function applyEdit(
  input: HTMLTextAreaElement,
  edit: TextEdit,
): void {
  input.setSelectionRange(edit.from, edit.to);
  if (edit.insert === '') document.execCommand('delete');
  else document.execCommand('insertText', false, edit.insert);
}
