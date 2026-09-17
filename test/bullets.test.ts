import { describe, expect, it } from 'vitest';

import { BULLET, bulletEdit } from '@/lib/bullets';

// Helper: '|' marks the caret, which keeps the cases readable.
const at = (marked: string) => {
  const caret = marked.indexOf('|');
  return { text: marked.replace('|', ''), caret };
};

const edit = (marked: string, key: string) => {
  const { text, caret } = at(marked);
  return bulletEdit(key, text, caret, caret);
};

// What the textarea would hold once the edit is replayed.
const applied = (marked: string, key: string) => {
  const { text, caret } = at(marked);
  const result = bulletEdit(key, text, caret, caret);
  if (!result) return null;
  return (
    text.slice(0, result.from) + result.insert + text.slice(result.to)
  );
};

describe('starting a list', () => {
  it('turns a lone dash into a bullet when the space is typed', () => {
    expect(applied('-|', ' ')).toBe(BULLET);
  });

  it('accepts an asterisk too — both are the Markdown habit', () => {
    expect(applied('*|', ' ')).toBe(BULLET);
  });

  it('works on a later line, not just the first', () => {
    expect(applied('Mon idée\n-|', ' ')).toBe(`Mon idée\n${BULLET}`);
  });

  it('leaves a dash inside a sentence alone', () => {
    expect(edit('coût-bénéfice-|', ' ')).toBeNull();
  });

  it('leaves an ordinary space alone', () => {
    expect(edit('Mon idée|', ' ')).toBeNull();
  });
});

describe('continuing a list', () => {
  it('carries the bullet down on the next line', () => {
    expect(applied(`${BULLET}premier|`, 'Enter')).toBe(
      `${BULLET}premier\n${BULLET}`,
    );
  });

  it('carries it when the caret splits the line', () => {
    expect(applied(`${BULLET}pre|mier`, 'Enter')).toBe(
      `${BULLET}pre\n${BULLET}mier`,
    );
  });

  it('ends the list on an item left empty', () => {
    expect(applied(`${BULLET}premier\n${BULLET}|`, 'Enter')).toBe(
      `${BULLET}premier\n`,
    );
  });

  it('leaves a line that is not a list alone', () => {
    expect(edit('Mon idée|', 'Enter')).toBeNull();
  });
});

describe('what it refuses to touch', () => {
  it('does nothing while a selection is being replaced', () => {
    expect(bulletEdit(' ', '-', 0, 1)).toBeNull();
  });

  it('does nothing for any other key', () => {
    expect(edit('-|', 'a')).toBeNull();
  });
});
