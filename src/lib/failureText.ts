import type { Failure } from './protocol';

// One table for the three screens: duplicating it would let the wording drift
// between surfaces that describe the very same failure.
const TEXT: Record<
  Failure['reason'],
  { title: string; body: string }
> = {
  offline: {
    title: 'Enregistrement impossible',
    body: "Le serveur n'a pas répondu. Ton texte est toujours là.",
  },
  server: {
    title: 'Enregistrement impossible',
    body: 'Le serveur a rencontré un problème. Ton texte est toujours là.',
  },
  rejected: {
    title: 'Refusé par le serveur',
    body: '',
  },
  unauthenticated: {
    title: 'Session expirée',
    body: 'Reconnecte-toi pour continuer.',
  },
  gone: {
    title: 'Idée introuvable',
    body: 'Elle a été supprimée depuis un autre appareil.',
  },
};

export function failureText(failure: Failure): {
  title: string;
  body: string;
} {
  const { title, body } = TEXT[failure.reason];

  // The server already phrased this one; repeating it in our own words would
  // say less, not more.
  return failure.reason === 'rejected'
    ? { title, body: failure.message }
    : { title, body };
}
