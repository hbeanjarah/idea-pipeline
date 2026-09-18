import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

import { noteKey } from '#config/env';

// The prefix carries the key version. The day NOTE_KEY_V2 arrives, v1 rows stay
// readable instead of all having to be rewritten the same day — which is the
// difference between a rotation that happens and one that never does.
export const SEALED_PREFIX = 'v1.';
const IV_BYTES = 12;
const TAG_BYTES = 16;

// The row's context is mixed into the signature, so a sealed value copied
// somewhere else no longer opens. Without it, a write straight to the database
// could move a note from one user to another.
//
// Callers pass what the value belongs to and cannot be detached from: the
// idea's id for a variation, the account's id for a stage name.
export function seal(text: string, context: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', noteKey(), iv);
  cipher.setAAD(Buffer.from(context));

  // final() before getAuthTag(): the tag does not exist until the last block
  // has gone through.
  const body = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  return (
    SEALED_PREFIX +
    Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
  );
}

export function open(stored: string, context: string): string {
  if (!stored.startsWith(SEALED_PREFIX)) {
    throw new Error('Unknown note encoding');
  }

  const packed = Buffer.from(
    stored.slice(SEALED_PREFIX.length),
    'base64',
  );
  // Buffer.from(…, 'base64') drops what it cannot read rather than throwing, so
  // a mangled value arrives here short, not broken. Said plainly now, or node
  // says "Invalid initialization vector" three frames away.
  if (packed.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Truncated note');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    noteKey(),
    packed.subarray(0, IV_BYTES),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(
    packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES),
  );

  return Buffer.concat([
    decipher.update(packed.subarray(IV_BYTES + TAG_BYTES)),
    decipher.final(),
  ]).toString('utf8');
}
