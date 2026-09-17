import { afterEach, describe, expect, it } from 'vitest';

import { noteKey } from '#config/env';

// The test harness sets a key for every other file; restoring it matters more
// than deleting it, since process.env is shared by the whole worker.
const original = process.env.NOTE_KEY_V1;

afterEach(() => {
  if (original === undefined) delete process.env.NOTE_KEY_V1;
  else process.env.NOTE_KEY_V1 = original;
});

describe('noteKey', () => {
  it('decodes 32 bytes from base64', () => {
    process.env.NOTE_KEY_V1 = Buffer.alloc(32, 7).toString('base64');

    expect(noteKey()).toEqual(Buffer.alloc(32, 7));
  });

  it('refuses to start without a key rather than write in clear', () => {
    delete process.env.NOTE_KEY_V1;

    expect(() => noteKey()).toThrow('NOTE_KEY_V1 is required');
  });

  it('treats an empty value as a missing one', () => {
    process.env.NOTE_KEY_V1 = '';

    expect(() => noteKey()).toThrow('NOTE_KEY_V1 is required');
  });

  it('refuses a key that is too short, and says by how much', () => {
    process.env.NOTE_KEY_V1 = Buffer.alloc(31).toString('base64');

    expect(() => noteKey()).toThrow('got 31');
  });

  it('refuses a key that is too long', () => {
    process.env.NOTE_KEY_V1 = Buffer.alloc(33).toString('base64');

    expect(() => noteKey()).toThrow('got 33');
  });

  // Buffer.from(…, 'base64') drops what it cannot read instead of throwing, so
  // a mangled key arrives here as a short one, not as an error.
  it('refuses a value that is not base64 at all', () => {
    process.env.NOTE_KEY_V1 = 'not base64 !!!';

    expect(() => noteKey()).toThrow('must decode to 32 bytes');
  });
});
