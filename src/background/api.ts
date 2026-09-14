import { DEFAULT_API_URL } from '@/lib/config';
import type { Failure } from '@/lib/protocol';
import type { Idea, Status, User } from '@/storage/types';

// Overridable at build time by VITE_API_URL, which vite.config.ts resolves and
// injects. Pinned to the local server until the API is hosted.
const API_URL = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;

export class ApiFailure extends Error {
  readonly failure: Failure;

  constructor(failure: Failure) {
    super(failure.reason);
    this.name = 'ApiFailure';
    this.failure = failure;
  }
}

const messageOf = (body: unknown): string =>
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  typeof body.error === 'string'
    ? body.error
    : 'Requête refusée.';

async function call<T>(
  token: string | null,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        // Omitted, not empty: POST /auth/google is the endpoint that creates
        // the session, so it has no token to present.
        ...(token === null
          ? {}
          : { Authorization: `Bearer ${token}` }),
        ...(init?.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      ...(init?.body === undefined
        ? {}
        : { body: JSON.stringify(init.body) }),
    });
  } catch {
    // fetch only rejects when the request never reached anyone.
    throw new ApiFailure({ reason: 'offline' });
  }

  if (response.status === 204) return null as T;
  if (response.ok) return (await response.json()) as T;

  if (response.status === 401) {
    throw new ApiFailure({ reason: 'unauthenticated' });
  }
  if (response.status === 404)
    throw new ApiFailure({ reason: 'gone' });
  if (response.status >= 500)
    throw new ApiFailure({ reason: 'server' });

  throw new ApiFailure({
    reason: 'rejected',
    message: messageOf(await response.json()),
  });
}

export const listIdeas = (token: string) =>
  call<Idea[]>(token, '/ideas');

export const createIdea = (token: string, text: string) =>
  call<Idea>(token, '/ideas', { method: 'POST', body: { text } });

export const addVariation = (
  token: string,
  ideaId: string,
  text: string,
) =>
  call<Idea>(token, `/ideas/${ideaId}/variations`, {
    method: 'POST',
    body: { text },
  });

export const editVariation = (
  token: string,
  ideaId: string,
  variationId: string,
  text: string,
) =>
  call<Idea>(token, `/ideas/${ideaId}/variations/${variationId}`, {
    method: 'PATCH',
    body: { text },
  });

export const changeStatus = (
  token: string,
  ideaId: string,
  status: Status,
) =>
  call<Idea>(token, `/ideas/${ideaId}`, {
    method: 'PATCH',
    body: { status },
  });

export const deleteIdea = (token: string, ideaId: string) =>
  call<null>(token, `/ideas/${ideaId}`, { method: 'DELETE' });

export const signInWithGoogle = (
  code: string,
  codeVerifier: string,
) =>
  call<{ token: string; user: User }>(null, '/auth/google', {
    method: 'POST',
    body: { code, codeVerifier },
  });

export const fetchIdentity = (token: string) =>
  call<User>(token, '/auth/me');

export const revokeSession = (token: string) =>
  call<null>(token, '/auth/session', { method: 'DELETE' });
