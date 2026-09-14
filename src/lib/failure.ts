import type { Displayable } from './failureText';
import { RepositoryError } from '@/storage/remote';

// Anything that is not a repository failure came from our own code, which is a
// server-side problem from the user's point of view: nothing they can fix.
//
// A cancellation cannot reach here: only the sign-in flow produces one, and it
// never travels through the idea repository. Folding it into 'server' rather
// than widening the type keeps every screen free of a case it cannot meet.
export function failureOf(error: unknown): Displayable {
  if (!(error instanceof RepositoryError)) {
    return { reason: 'server' };
  }

  return error.failure.reason === 'cancelled'
    ? { reason: 'server' }
    : error.failure;
}
