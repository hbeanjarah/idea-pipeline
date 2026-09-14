import type { Failure } from './protocol';
import { RepositoryError } from '@/storage/remote';

// Anything that is not a repository failure came from our own code, which is a
// server-side problem from the user's point of view: nothing they can fix.
export function failureOf(error: unknown): Failure {
  return error instanceof RepositoryError
    ? error.failure
    : { reason: 'server' };
}
