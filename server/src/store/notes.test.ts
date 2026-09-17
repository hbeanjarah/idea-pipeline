import { describe, expect, it } from 'vitest';

import { open, seal } from '#store/notes';

const IDEA = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

// Flip one bit of the base64 payload, leaving the prefix alone.
//
// writeUInt8 rather than packed[at]: an indexed write past the end of a Buffer
// is silently ignored, so a wrong index would hand back an untouched note and
// the test would pass having proved nothing. These two throw instead.
const tamper = (sealed: string, at: number): string => {
  const packed = Buffer.from(sealed.slice(3), 'base64');
  packed.writeUInt8(packed.readUInt8(at) ^ 1, at);

  return 'v1.' + packed.toString('base64');
};

describe('a sealed note', () => {
  it('comes back as it went in', () => {
    expect(open(seal('Mon idée', IDEA), IDEA)).toBe('Mon idée');
  });

  it('survives accents, emojis, bullets and line breaks', () => {
    const text = 'Réunion — budget 🎯\n• premier\n• deuxième\n\nFin.';

    expect(open(seal(text, IDEA), IDEA)).toBe(text);
  });

  it('survives a long note', () => {
    const text = 'a'.repeat(10_000);

    expect(open(seal(text, IDEA), IDEA)).toBe(text);
  });

  it('never looks the same twice, so identical notes stay indistinguishable', () => {
    expect(seal('Réunion budget', IDEA)).not.toBe(
      seal('Réunion budget', IDEA),
    );
  });
});

describe('what it refuses to open', () => {
  it('a note whose body was altered', () => {
    const sealed = seal('Mon idée', IDEA);

    // The body starts after the 12-byte IV and the 16-byte tag.
    expect(() => open(tamper(sealed, 28), IDEA)).toThrow();
  });

  it('a note whose signature was altered', () => {
    const sealed = seal('Mon idée', IDEA);

    // The tag sits right after the 12-byte IV.
    expect(() => open(tamper(sealed, 12), IDEA)).toThrow();
  });

  it('a note moved to another idea — hence to another account', () => {
    const sealed = seal('Mon idée', IDEA);

    expect(() => open(sealed, OTHER)).toThrow();
  });

  it('plain text that was never sealed', () => {
    expect(() => open('Mon idée', IDEA)).toThrow(
      'Unknown note encoding',
    );
  });

  it('a value cut short, with a message that says so', () => {
    expect(() => open('v1.abc', IDEA)).toThrow('Truncated note');
  });
});
