import type { Failure } from './protocol';

// Reading and writing fail for the same reasons but do not worry the user about
// the same thing: one asks "are my ideas lost?", the other "is my text lost?".
export type Attempted = 'read' | 'write';

const TEXT: Record<
  Attempted,
  Record<Failure['reason'], { title: string; body: string }>
> = {
  write: {
    offline: {
      title: 'Enregistrement impossible',
      body: "Le serveur n'a pas répondu. Ton texte est toujours là.",
    },
    server: {
      title: 'Enregistrement impossible',
      body: 'Le serveur a rencontré un problème. Ton texte est toujours là.',
    },
    rejected: { title: 'Refusé par le serveur', body: '' },
    unauthenticated: {
      title: 'Session expirée',
      body: 'Reconnecte-toi pour enregistrer.',
    },
    gone: {
      title: 'Idée introuvable',
      body: 'Elle a été supprimée depuis un autre appareil.',
    },
  },
  read: {
    offline: {
      title: 'Chargement impossible',
      body: "Le serveur n'a pas répondu. Rien n'est perdu — tes idées sont sur le serveur.",
    },
    server: {
      title: 'Chargement impossible',
      body: 'Le serveur a rencontré un problème. Rien n’est perdu.',
    },
    rejected: { title: 'Refusé par le serveur', body: '' },
    unauthenticated: {
      title: 'Session expirée',
      body: 'Reconnecte-toi pour retrouver tes idées.',
    },
    gone: {
      title: 'Idée introuvable',
      body: 'Elle a été supprimée depuis un autre appareil.',
    },
  },
};

export function failureText(
  failure: Failure,
  attempted: Attempted,
): { title: string; body: string } {
  const { title, body } = TEXT[attempted][failure.reason];

  // The server already phrased this one; repeating it in our own words would
  // say less, not more.
  return failure.reason === 'rejected'
    ? { title, body: failure.message }
    : { title, body };
}
