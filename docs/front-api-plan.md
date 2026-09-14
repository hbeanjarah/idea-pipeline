# Liaison front ↔ API — plan d'implémentation

> **Pour l'exécutant :** les étapes sont des cases à cocher (`- [ ]`). Une étape
> = une action. On ne passe pas à la suivante sans avoir lancé la vérification de
> la précédente.

**But :** l'extension lit et écrit ses idées dans l'API, sans que le panneau
latéral ne voie jamais le jeton de session.

**Architecture :** le service worker détient le jeton et fait seul les appels
réseau. Le panneau lui parle par messages. `IdeaRepository` reste l'unique
frontière : `IdeasProvider` ne change pas d'interface.

**Pile :** aucune dépendance nouvelle.

**Spec :** `docs/front-api-design.md` (validée). Maquette : `design/mockup-auth.html`.

## Contraintes globales

- **Git : 100 % manuel.** Les étapes « Commit » donnent le **texte** du message.
- **Installation : 100 % manuelle.** Sans objet : la brique n'installe rien.
- **Code en anglais**, commentaires compris. Le français est réservé aux textes
  vus par l'utilisateur.
- **CSS Modules colocalisés**, CSS pur, aucun framework UI. Les couleurs sortent
  de `src/styles/tokens.css`, jamais en dur.
- **Commentaires** : jamais de bloc de documentation, jamais de paraphrase.
- **Le livré passe `pnpm lint`, `pnpm typecheck` et `pnpm test`** sans erreur.
- L'API tourne en local : `docker compose up -d --wait` puis
  `pnpm --dir server dev`.

## Deux faits vérifiés dans le code, qui dictent le plan

**1. `Composer` vide son champ sans attendre.**

```tsx
onSubmit(trimmed); // prop typé (text: string) => void
setText(''); // exécuté immédiatement
```

Avec `chrome.storage`, sans conséquence. Avec HTTP, **le texte disparaît avant
la réponse du serveur** — la règle « un texte saisi ne disparaît jamais » tombe
dès le premier échec. La tâche 4 change ce contrat ; ce n'est pas un
raffinement.

**2. `chrome.runtime.onMessage` exige un `return true`** pour garder le canal
ouvert le temps d'une réponse asynchrone. Sans lui, le panneau reçoit
`undefined` — un échec qui ressemble à un succès vide. La tâche 2 le pose et le
teste.

## Structure des fichiers

| Fichier                                                              | Rôle                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/protocol.ts`                                                | **créer** — le protocole, partagé par les deux contextes                 |
| `src/background/api.ts`                                              | **créer** — le seul `fetch` du projet                                    |
| `src/background/session.ts`                                          | **créer** — le jeton                                                     |
| `src/background/messages.ts`                                         | **créer** — un message → une opération                                   |
| `src/background/index.ts`                                            | **modifier** — enregistre le routeur                                     |
| `src/storage/remote.ts`                                              | **créer** — `MessagingIdeaRepository`                                    |
| `src/hooks/SessionProvider.tsx` · `useSession.ts`                    | **créer** — y a-t-il une session ?                                       |
| `src/screens/SignInScreen.tsx` + `.module.css`                       | **créer** — la 4ᵉ surface                                                |
| `src/components/Alert/Alert.tsx` + `.module.css`                     | **créer** — échec et information                                         |
| `src/components/Composer/Composer.tsx`                               | **modifier** — ne vide qu'au succès                                      |
| `src/hooks/IdeasProvider.tsx` · `useIdeas.ts`                        | **modifier** — état d'échec                                              |
| `src/screens/HomeScreen.tsx` · `ListScreen.tsx` · `DetailScreen.tsx` | **modifier**                                                             |
| `src/sidepanel/App.tsx`                                              | **modifier** — choisit la surface                                        |
| `src/manifest.ts`                                                    | **modifier** — `host_permissions`                                        |
| `test/chromeStorageStub.ts`                                          | **modifier** — ajoute `session`                                          |
| `test/chromeRuntimeStub.ts`                                          | **créer**                                                                |
| `test/session.test.ts` · `api.test.ts` · `remote.test.ts`            | **créer** — le projet vitest `front` ne collecte que `test/**/*.test.ts` |

---

## Tâche 1 : le protocole, le jeton, le client HTTP

Côté worker uniquement. Aucune interface, aucun message : du code testable seul.

**Interfaces produites :**

- `Request`, `Failure`, `ReplyData`, `Reply<K>` depuis `#lib/protocol` (chemins
  relatifs côté front — il n'y a pas d'alias `#` dans l'extension)
- `readToken(): Promise<string | null>` · `writeToken(token: string): Promise<void>` ·
  `clearToken(): Promise<void>`
- `ApiFailure` (classe portant un `Failure`)
- `listIdeas(token)` · `createIdea(token, text)` · `addVariation(token, ideaId, text)` ·
  `editVariation(token, ideaId, variationId, text)` · `changeStatus(token, ideaId, status)` ·
  `deleteIdea(token, ideaId)`

- [ ] **Étape 1 : écrire le protocole**

Fichier `src/lib/protocol.ts` :

```typescript
import type { Idea, Status } from '../storage/types';

export type Request =
  | { kind: 'ideas/list' }
  | { kind: 'ideas/create'; text: string }
  | { kind: 'ideas/addVariation'; ideaId: string; text: string }
  | {
      kind: 'ideas/editVariation';
      ideaId: string;
      variationId: string;
      text: string;
    }
  | { kind: 'ideas/changeStatus'; ideaId: string; status: Status }
  | { kind: 'ideas/delete'; ideaId: string }
  | { kind: 'session/status' }
  | { kind: 'session/set'; token: string }
  | { kind: 'session/clear' };

export type Failure =
  | { reason: 'offline' }
  | { reason: 'unauthenticated' }
  | { reason: 'gone' }
  | { reason: 'rejected'; message: string }
  | { reason: 'server' };

// What each request answers. Without this table a caller casts by hand, and a
// mismatch only shows at runtime.
export interface ReplyData {
  'ideas/list': Idea[];
  'ideas/create': Idea;
  'ideas/addVariation': Idea;
  'ideas/editVariation': Idea;
  'ideas/changeStatus': Idea;
  'ideas/delete': null;
  'session/status': { connected: boolean };
  'session/set': { connected: boolean };
  'session/clear': null;
}

export type Reply<K extends Request['kind']> =
  | { ok: true; data: ReplyData[K] }
  | { ok: false; failure: Failure };
```

`ideas/delete` répond `null` et non `void` : une valeur doit traverser
`sendMessage`, et `undefined` y est déjà le signal du canal rompu.

- [ ] **Étape 2 : étendre le bouchon de stockage**

Dans `test/chromeStorageStub.ts`, généraliser l'objet retourné pour porter deux
aires. Remplacer l'interface et le corps par :

```typescript
export interface StorageArea {
  get(
    keys?: string | string[] | StorageRecord | null,
  ): Promise<StorageRecord>;
  set(items: StorageRecord): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface ChromeStorageStub {
  local: StorageArea;
  session: StorageArea;
}

function createArea(): StorageArea {
  let store: StorageRecord = {};

  return {
    async get(keys) {
      if (keys === null || keys === undefined) return { ...store };
      if (typeof keys === 'string') {
        return keys in store ? { [keys]: store[keys] } : {};
      }
      if (Array.isArray(keys)) {
        const result: StorageRecord = {};
        for (const key of keys) {
          if (key in store) result[key] = store[key];
        }
        return result;
      }
      const result: StorageRecord = {};
      for (const [key, fallback] of Object.entries(keys)) {
        result[key] = key in store ? store[key] : fallback;
      }
      return result;
    },
    async set(items) {
      store = { ...store, ...items };
    },
    async remove(keys) {
      const doomed = typeof keys === 'string' ? [keys] : keys;
      const next = { ...store };
      for (const key of doomed) delete next[key];
      store = next;
    },
  };
}

export function createChromeStorageStub(): ChromeStorageStub {
  return { local: createArea(), session: createArea() };
}
```

- [ ] **Étape 3 : écrire les tests du jeton**

Fichier `test/session.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';

import {
  clearToken,
  readToken,
  writeToken,
} from '../src/background/session';

describe('the session token', () => {
  it('starts absent', async () => {
    expect(await readToken()).toBeNull();
  });

  it('survives a read after being written', async () => {
    await writeToken('abc');

    expect(await readToken()).toBe('abc');
  });

  it('is read fresh every time, never cached in a module', async () => {
    await writeToken('first');
    await writeToken('second');

    // The worker dies every 30s; a module-level cache would serve a stale
    // token after Chrome restarted it.
    expect(await readToken()).toBe('second');
  });

  it('is gone after clearing', async () => {
    await writeToken('abc');

    await clearToken();

    expect(await readToken()).toBeNull();
  });
});
```

- [ ] **Étape 4 : lancer, vérifier l'échec**

Run : `pnpm exec vitest run --project front session`
Attendu : **ÉCHEC**, `Cannot find module '../src/background/session'`.

- [ ] **Étape 5 : écrire le jeton**

Fichier `src/background/session.ts` :

```typescript
const KEY = 'sessionToken';

// storage.session is in memory only, never written to disk, and not exposed to
// content scripts. The worker is stopped after ~30s idle, so the token is read
// back from here on every wake — a module variable would not survive.
export async function readToken(): Promise<string | null> {
  const stored = await chrome.storage.session.get(KEY);
  const token = stored[KEY];

  return typeof token === 'string' ? token : null;
}

export async function writeToken(token: string): Promise<void> {
  await chrome.storage.session.set({ [KEY]: token });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.session.remove(KEY);
}
```

- [ ] **Étape 6 : écrire les tests du client HTTP**

Fichier `test/api.test.ts` :

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiFailure,
  createIdea,
  deleteIdea,
  listIdeas,
} from '../src/background/api';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

const reasonOf = async (
  promise: Promise<unknown>,
): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    return (error as ApiFailure).failure.reason;
  }
  throw new Error('expected a failure');
};

describe('the http client', () => {
  it('returns what the api answered', async () => {
    vi.stubGlobal('fetch', respond(200, []));

    expect(await listIdeas('token')).toEqual([]);
  });

  it('sends the session token as a bearer', async () => {
    const fetched = respond(200, []);
    vi.stubGlobal('fetch', fetched);

    await listIdeas('the-token');

    const init = fetched.mock.calls[0]![1] as {
      headers: Record<string, string>;
    };
    expect(init.headers.Authorization).toBe('Bearer the-token');
  });

  it('reads 401 as a dead session', async () => {
    vi.stubGlobal(
      'fetch',
      respond(401, { error: 'Authentification requise.' }),
    );

    expect(await reasonOf(listIdeas('token'))).toBe(
      'unauthenticated',
    );
  });

  it('reads 404 as an idea that is gone', async () => {
    vi.stubGlobal(
      'fetch',
      respond(404, { error: 'Idée introuvable.' }),
    );

    expect(await reasonOf(deleteIdea('token', 'id'))).toBe('gone');
  });

  it('carries the server message through on 400', async () => {
    vi.stubGlobal(
      'fetch',
      respond(400, { error: 'Champs non autorisés.' }),
    );

    try {
      await createIdea('token', 'x');
      throw new Error('expected a failure');
    } catch (error) {
      const { failure } = error as ApiFailure;
      expect(failure).toEqual({
        reason: 'rejected',
        message: 'Champs non autorisés.',
      });
    }
  });

  it('reads 500 as a server fault', async () => {
    vi.stubGlobal('fetch', respond(500, {}));

    expect(await reasonOf(listIdeas('token'))).toBe('server');
  });

  it('reads a network failure as being offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('failed')),
    );

    expect(await reasonOf(listIdeas('token'))).toBe('offline');
  });

  it('accepts an empty body on delete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 204,
        ok: true,
        json: async () => null,
      }),
    );

    expect(await deleteIdea('token', 'id')).toBeNull();
  });
});
```

- [ ] **Étape 7 : lancer, vérifier l'échec**

Run : `pnpm exec vitest run --project front api`
Attendu : **ÉCHEC**, `Cannot find module '../src/background/api'`.

- [ ] **Étape 8 : écrire le client HTTP**

Fichier `src/background/api.ts` :

```typescript
import type { Failure } from '../lib/protocol';
import type { Idea, Status } from '../storage/types';

// One place holds the address. Hosting will make it configurable; today it is
// the local server and nothing else.
const BASE = 'http://localhost:3000';

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
  token: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
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
```

- [ ] **Étape 9 : lancer les deux fichiers**

Run : `pnpm exec vitest run --project front api session`
Attendu : les 12 tests passent.

- [ ] **Étape 10 : prouver que la table des statuts n'est pas décorative**

Sabotage : dans `api.ts`, remplacer `response.status === 404` par
`response.status === 409`, relancer.
Attendu : **ÉCHEC** de `reads 404 as an idea that is gone`. Rétablir.

- [ ] **Étape 11 : typecheck, lint, format**

Run : `pnpm typecheck && pnpm lint && pnpm exec prettier --check .`

- [ ] **Étape 12 : commit (PO)**

```
feat(extension): add the api client and the session token holder

The token lives in storage.session — memory only, never on disk — and is read
back on every call: MV3 stops the worker after 30s idle, so a module-level
cache would serve a stale value after a restart.
```

---

## Tâche 2 : le routeur de messages et le dépôt distant

**Interfaces produites :**

- `handle(request: Request): Promise<Reply<...>>` depuis `./messages`
- `RepositoryError` et `MessagingIdeaRepository` depuis `../storage/remote`

- [ ] **Étape 1 : écrire le bouchon de messagerie**

Fichier `test/chromeRuntimeStub.ts` :

```typescript
// Stand-in for chrome.runtime.sendMessage, for tests only. A test decides what
// the worker answers — including answering nothing, which is what a dead worker
// looks like from the panel.
export interface ChromeRuntimeStub {
  sendMessage(message: unknown): Promise<unknown>;
  reply(answer: unknown): void;
  sent: unknown[];
}

export function createChromeRuntimeStub(): ChromeRuntimeStub {
  let answer: unknown = undefined;
  const sent: unknown[] = [];

  return {
    sent,
    reply(next) {
      answer = next;
    },
    async sendMessage(message) {
      sent.push(message);
      return answer;
    },
  };
}
```

Puis dans `test/setup.ts`, installer les deux bouchons :

```typescript
import { beforeEach } from 'vitest';
import { createChromeStorageStub } from './chromeStorageStub';
import { createChromeRuntimeStub } from './chromeRuntimeStub';

beforeEach(() => {
  globalThis.chrome = {
    storage: createChromeStorageStub(),
    runtime: createChromeRuntimeStub(),
  } as unknown as typeof chrome;
});
```

- [ ] **Étape 2 : écrire les tests du dépôt distant**

Fichier `test/remote.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';

import {
  MessagingIdeaRepository,
  RepositoryError,
} from '../src/storage/remote';

const runtime = () =>
  globalThis.chrome.runtime as unknown as {
    reply(answer: unknown): void;
    sent: unknown[];
  };

const repository = new MessagingIdeaRepository();

describe('the messaging repository', () => {
  it('hands back what the worker answered', async () => {
    runtime().reply({ ok: true, data: [] });

    expect(await repository.list()).toEqual([]);
  });

  it('asks for exactly one operation', async () => {
    runtime().reply({ ok: true, data: [] });

    await repository.create('une idée');

    expect(runtime().sent).toEqual([
      { kind: 'ideas/create', text: 'une idée' },
    ]);
  });

  it('turns a refusal into a throw carrying its reason', async () => {
    runtime().reply({ ok: false, failure: { reason: 'offline' } });

    await expect(repository.list()).rejects.toMatchObject({
      failure: { reason: 'offline' },
    });
  });

  it('treats silence as a failure, never as an empty success', async () => {
    // A dead worker, or a listener that forgot `return true`, answers
    // undefined. Letting that through would hand the screens an empty list
    // and look exactly like success.
    runtime().reply(undefined);

    await expect(repository.list()).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });
});
```

- [ ] **Étape 3 : lancer, vérifier l'échec**

Run : `pnpm exec vitest run --project front remote`
Attendu : **ÉCHEC**, `Cannot find module '../src/storage/remote'`.

- [ ] **Étape 4 : écrire le dépôt distant**

Fichier `src/storage/remote.ts` :

```typescript
import type {
  Failure,
  Reply,
  ReplyData,
  Request,
} from '../lib/protocol';
import type { IdeaRepository } from './storage';
import type { Idea, Status } from './types';

export class RepositoryError extends Error {
  readonly failure: Failure;

  constructor(failure: Failure) {
    super(failure.reason);
    this.name = 'RepositoryError';
    this.failure = failure;
  }
}

async function ask<K extends Request['kind']>(
  request: Extract<Request, { kind: K }>,
): Promise<ReplyData[K]> {
  const reply = (await chrome.runtime.sendMessage(request)) as
    | Reply<K>
    | undefined;

  // undefined means the worker never answered: stopped mid-flight, or a
  // listener that forgot to keep the channel open.
  if (!reply) throw new RepositoryError({ reason: 'server' });
  if (!reply.ok) throw new RepositoryError(reply.failure);

  return reply.data;
}

export class MessagingIdeaRepository implements IdeaRepository {
  async list(): Promise<Idea[]> {
    return ask({ kind: 'ideas/list' });
  }

  async create(text: string): Promise<Idea> {
    return ask({ kind: 'ideas/create', text });
  }

  async addVariation(ideaId: string, text: string): Promise<Idea> {
    return ask({ kind: 'ideas/addVariation', ideaId, text });
  }

  async editVariation(
    ideaId: string,
    variationId: string,
    text: string,
  ): Promise<Idea> {
    return ask({
      kind: 'ideas/editVariation',
      ideaId,
      variationId,
      text,
    });
  }

  async changeStatus(ideaId: string, status: Status): Promise<Idea> {
    return ask({ kind: 'ideas/changeStatus', ideaId, status });
  }

  async delete(ideaId: string): Promise<void> {
    await ask({ kind: 'ideas/delete', ideaId });
  }
}
```

- [ ] **Étape 5 : écrire le routeur**

Fichier `src/background/messages.ts` :

```typescript
import * as api from './api';
import { clearToken, readToken, writeToken } from './session';
import { ApiFailure } from './api';
import type { Failure, Request } from '../lib/protocol';

type AnyReply =
  | { ok: true; data: unknown }
  | { ok: false; failure: Failure };

const failed = (failure: Failure): AnyReply => ({
  ok: false,
  failure,
});

async function withToken(
  run: (token: string) => Promise<unknown>,
): Promise<AnyReply> {
  const token = await readToken();
  if (token === null) return failed({ reason: 'unauthenticated' });

  try {
    return { ok: true, data: await run(token) };
  } catch (error) {
    if (error instanceof ApiFailure) {
      // A dead session is worth forgetting right away: every later call would
      // fail the same way, and the panel must land on the sign-in screen.
      if (error.failure.reason === 'unauthenticated')
        await clearToken();
      return failed(error.failure);
    }
    throw error;
  }
}

export async function handle(request: Request): Promise<AnyReply> {
  switch (request.kind) {
    case 'session/status':
      return {
        ok: true,
        data: { connected: (await readToken()) !== null },
      };
    case 'session/set':
      await writeToken(request.token);
      return { ok: true, data: { connected: true } };
    case 'session/clear':
      await clearToken();
      return { ok: true, data: null };
    case 'ideas/list':
      return withToken((token) => api.listIdeas(token));
    case 'ideas/create':
      return withToken((token) =>
        api.createIdea(token, request.text),
      );
    case 'ideas/addVariation':
      return withToken((token) =>
        api.addVariation(token, request.ideaId, request.text),
      );
    case 'ideas/editVariation':
      return withToken((token) =>
        api.editVariation(
          token,
          request.ideaId,
          request.variationId,
          request.text,
        ),
      );
    case 'ideas/changeStatus':
      return withToken((token) =>
        api.changeStatus(token, request.ideaId, request.status),
      );
    case 'ideas/delete':
      return withToken((token) =>
        api.deleteIdea(token, request.ideaId),
      );
  }
}
```

- [ ] **Étape 6 : brancher le routeur**

Ajouter à la fin de `src/background/index.ts` :

```typescript
// Returning true keeps the message channel open for the async answer. Without
// it the panel receives undefined, which looks like an empty success.
chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse) => {
    void handle(request as Request).then(sendResponse);
    return true;
  },
);
```

…et l'import `import { handle } from './messages';` plus
`import type { Request } from '../lib/protocol';` en tête.

- [x] **Étape 7 : autoriser l'hôte dans le manifeste** — _faite en avance_

`src/manifest.ts` est devenu une fonction recevant l'adresse de l'API, et
`vite.config.ts` la résout une fois pour la donner à la fois au manifeste et au
bundle. `host_permissions` ne peut donc pas diverger de l'adresse réellement
appelée — s'ils divergeaient, Chrome bloquerait la requête sans message utile.

C'est aussi ce qui dispense de CORS : une page d'extension atteint un hôte de
ses `host_permissions` sans qu'aucun en-tête ne soit produit côté serveur.

- [ ] **Étape 8 : lancer**

Run : `pnpm test`
Attendu : tout au vert, y compris les 4 nouveaux tests de `remote.test.ts`.

- [ ] **Étape 9 : typecheck, lint, format**

Run : `pnpm typecheck && pnpm lint && pnpm exec prettier --check .`

- [ ] **Étape 10 : commit (PO)**

```
feat(extension): route data access through the service worker

The panel sends messages and never touches the network, so the token stays in
a context the DOM cannot reach. A missing answer is treated as a failure: a
listener without `return true` answers undefined, which otherwise reads as an
empty success.
```

---

## Tâche 3 : la session côté panneau et la quatrième surface

Première fois que l'extension parle vraiment à l'API.

- [ ] **Étape 1 : écrire le contexte de session**

Fichier `src/hooks/useSession.ts` :

```typescript
import { createContext, useContext } from 'react';

export interface SessionContextValue {
  connected: boolean;
  checking: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const SessionContext =
  createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      'useSession must be used within a SessionProvider',
    );
  }
  return context;
}
```

Fichier `src/hooks/SessionProvider.tsx` :

```typescript
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SessionContext } from './useSession';
import type { Reply } from '../lib/protocol';

interface Props {
  children: ReactNode;
}

const ask = async <K extends 'session/status' | 'session/set'>(
  request: { kind: K } & Record<string, unknown>,
): Promise<boolean> => {
  const reply = (await chrome.runtime.sendMessage(request)) as
    | Reply<'session/status'>
    | undefined;

  return reply?.ok === true && reply.data.connected;
};

export function SessionProvider({ children }: Props) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    void ask({ kind: 'session/status' }).then((result) => {
      if (!active) return;
      setConnected(result);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (token: string) => {
    setConnected(await ask({ kind: 'session/set', token }));
  }, []);

  const signOut = useCallback(async () => {
    await chrome.runtime.sendMessage({ kind: 'session/clear' });
    setConnected(false);
  }, []);

  const value = useMemo(
    () => ({ connected, checking, signIn, signOut }),
    [connected, checking, signIn, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
```

- [ ] **Étape 2 : écrire la quatrième surface**

Fichier `src/screens/SignInScreen.tsx` :

```typescript
import { useState } from 'react';
import { useSession } from '../hooks/useSession';
import styles from './SignInScreen.module.css';

// Temporary: this brick pastes a token by hand. The Google brick replaces this
// form — and only this form — with launchWebAuthFlow.
export default function SignInScreen() {
  const { signIn } = useSession();
  const [token, setToken] = useState('');

  const submit = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    await signIn(trimmed);
  };

  return (
    <main className={styles.signIn}>
      <p className={styles.title}>Tes idées, sur tous tes navigateurs</p>
      <p className={styles.lead}>
        Connecte-toi pour retrouver ton pipeline ici et ailleurs.
      </p>
      <input
        id="session-token"
        className={styles.field}
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="Colle ton jeton de session"
        autoComplete="off"
      />
      <button className={styles.button} type="button" onClick={() => void submit()}>
        Se connecter
      </button>
      <p className={styles.legal}>
        Étape provisoire : la connexion Google arrive avec la brique suivante.
      </p>
    </main>
  );
}
```

Fichier `src/screens/SignInScreen.module.css` — reprendre la colonne
« Connexion » de `design/mockup-auth.html` : `.signIn` en colonne centrée,
padding `34px 10px 28px` ; `.title` 15px/600 ; `.lead` 12px `var(--hint)`,
`max-width: 32ch` ; `.field` fond `var(--card)`, bordure `var(--capbd)`,
rayon `var(--radius-md)`, padding `10px 12px` ; `.button` identique au `.btn-g`
de la maquette, `width: 100%` ; `.legal` 11px `var(--faint)`.

- [ ] **Étape 3 : choisir la surface dans `App.tsx`**

Envelopper l'arbre et brancher le choix :

```typescript
export default function App() {
  return (
    <SessionProvider>
      <Surfaces />
    </SessionProvider>
  );
}
```

…où `Surfaces` contient le corps actuel de `App`, précédé de :

```typescript
  const { connected, checking } = useSession();

  if (checking) return null;
  if (!connected) return <SignInScreen />;
```

`checking` évite d'afficher l'écran de connexion pendant l'interrogation du
worker — un clignotement à chaque ouverture du panneau sinon.

- [ ] **Étape 4 : basculer le dépôt**

Dans `src/storage/storage.ts`, remplacer la dernière ligne :

```typescript
export const ideaRepository: IdeaRepository =
  new MessagingIdeaRepository();
```

…et importer `MessagingIdeaRepository` depuis `./remote`.

`ChromeStorageIdeaRepository` **reste dans le fichier** : le script de reprise
en aura besoin pour lire l'ancien stockage.

- [ ] **Étape 5 : vérifier de bout en bout, à la main**

```bash
docker compose up -d --wait
pnpm --dir server dev &
pnpm build
```

Charger `dist/` dans `chrome://extensions`, ouvrir le panneau. Attendu :
l'écran de connexion. Fabriquer un jeton :

```bash
psql_() { docker compose exec -T db psql -U idea -d idea_pipeline -tAqc "$1"; }
TOKEN=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
HASH=$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)
USERID=$(psql_ "INSERT INTO users (google_sub, email) VALUES ('sub-manuel','moi@example.test')
                ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email RETURNING id" | head -1)
psql_ "INSERT INTO sessions (user_id, token_hash, user_agent, expires_at)
       VALUES ('$USERID','$HASH','extension', now() + interval '30 days')"
echo "$TOKEN"
```

Le coller dans le champ. Attendu : l'accueil s'affiche, vide. Capturer une idée,
puis vérifier qu'elle est bien en base :

```bash
psql_ "SELECT text FROM variations"
```

- [ ] **Étape 6 : typecheck, lint, format, tests**

Run : `pnpm typecheck && pnpm lint && pnpm exec prettier --check . && pnpm test`

- [ ] **Étape 7 : commit (PO)**

```
feat(extension): read and write ideas through the api

The panel now shows a sign-in surface until the worker holds a session. Pasting
the token is deliberately temporary — the Google brick replaces that form and
nothing else.
```

---

## Tâche 4 : les échecs dans l'interface

Le cœur de la brique. Sans elle, tout échec réseau est silencieux.

- [ ] **Étape 1 : `Composer` ne vide qu'au succès**

Dans `src/components/Composer/Composer.tsx`, changer le type du prop :

```typescript
onSubmit: (text: string) => Promise<unknown>;
```

…et le corps de `submit` :

```typescript
const submit = async () => {
  const trimmed = text.trim();
  if (!trimmed || busy) return;

  setBusy(true);
  try {
    await onSubmit(trimmed);
    // Cleared only once the server has confirmed: an idea typed and lost to a
    // network failure would be worse than the local-only behaviour we left.
    setText('');
  } catch {
    // The screen shows the failure; the text stays where the user left it.
  } finally {
    setBusy(false);
  }
};
```

…avec `const [busy, setBusy] = useState(false);` près de `text`, et
`onClick={() => void submit()}` sur le bouton. Le garde `busy` empêche un double
envoi pendant que le serveur réfléchit.

- [ ] **Étape 2 : écrire le composant d'alerte**

Fichier `src/components/Alert/Alert.tsx` :

```typescript
import styles from './Alert.module.css';

interface Props {
  title: string;
  children: string;
  onRetry?: () => void;
}

export default function Alert({ title, children, onRetry }: Props) {
  return (
    <div className={styles.alert} role="alert">
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16.5v.5" />
      </svg>
      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        {children}
        {onRetry && (
          <button className={styles.retry} type="button" onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
```

Fichier `src/components/Alert/Alert.module.css` — reprendre `.alert` de
`design/mockup-auth.html` : fond `var(--danger-bg)`, bordure 1px `#eddcd7`,
rayon `var(--radius-md)`, padding `9px 11px`, `display: flex`, `gap: 8px` ;
`.title` en `var(--danger)` gras ; `.retry` en `var(--accent)`, sans fond ni
bordure, avec un `:focus-visible` visible.

- [ ] **Étape 3 : exposer l'échec depuis `IdeasProvider`**

Ajouter à `IdeasContextValue` dans `src/hooks/useIdeas.ts` :

```typescript
  failure: Failure | null;
  retry: (() => void) | null;
  dismissFailure: () => void;
```

Dans `IdeasProvider`, tenir les deux états et envelopper chaque opération :

```typescript
const [failure, setFailure] = useState<Failure | null>(null);
const [retry, setRetry] = useState<(() => void) | null>(null);

// Every operation funnels through here so no screen invents its own error
// handling — they would drift.
const attempt = useCallback(
  async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      const result = await run();
      setFailure(null);
      setRetry(null);
      return result;
    } catch (error) {
      const next =
        error instanceof RepositoryError
          ? error.failure
          : ({ reason: 'server' } as Failure);

      // An idea deleted on another device is not a failure to retry: the
      // local list is simply out of date.
      if (next.reason === 'gone') {
        void reload();
      }
      setFailure(next);
      setRetry(() => () => void attempt(run));
      throw error;
    }
  },
  [reload],
);
```

…où `reload` est le chargement initial extrait en `useCallback`, réutilisé par
l'effet de montage. Chaque opération devient
`return attempt(() => ideaRepository.create(text))`, etc.

- [ ] **Étape 4 : afficher l'échec dans les trois écrans**

Dans `HomeScreen`, insérer juste après le `<Composer …/>` et son `hint` :

```tsx
{
  failure && failure.reason !== 'gone' && (
    <Alert
      title={TITLES[failure.reason]}
      onRetry={retry ?? undefined}
    >
      {MESSAGES[failure.reason]}
    </Alert>
  );
}
```

…avec, en tête de fichier, les deux tables de libellés :

```typescript
const TITLES: Record<string, string> = {
  offline: 'Idée non enregistrée',
  server: 'Idée non enregistrée',
  rejected: 'Idée refusée',
  unauthenticated: 'Session expirée',
};

const MESSAGES: Record<string, string> = {
  offline: "Le serveur n'a pas répondu. Ton texte est toujours là.",
  server:
    'Le serveur a rencontré un problème. Ton texte est toujours là.',
  rejected: 'Cette idée a été refusée par le serveur.',
  unauthenticated: 'Reconnecte-toi pour continuer.',
};
```

Reproduire le même bloc dans `ListScreen` sous la barre de titre, et dans
`DetailScreen` sous le champ de reformulation.

- [ ] **Étape 5 : le chargement initial échoué**

Dans `HomeScreen`, quand `!loading && failure && ideas.length === 0`, remplacer
le bloc vide par l'état « Impossible de charger tes idées » de la maquette, avec
son bouton _Réessayer_.

- [ ] **Étape 6 : reconnaître ce qui n'est pas testable ici**

**Aucun test automatique ne couvre cette tâche**, et il faut le dire plutôt que
de le maquiller. `Composer` et `IdeasProvider` sont des composants React : les
éprouver demande de les rendre, donc une bibliothèque de test React, qui n'est
pas dans la pile.

Écrire à la place un test qui rejoue « la promesse échoue donc on ne vide pas »
sans monter le composant ne prouverait **rien** : il vérifierait le raisonnement
du plan, pas le code livré. C'est exactement le genre de test qui passe au vert
pendant que la fonctionnalité est cassée.

La garantie repose donc entièrement sur l'étape 7, faite à la main. Si le PO veut
qu'elle soit tenue par une machine, il faut arbitrer l'ajout de
`@testing-library/react` — hors pile figée, donc sa décision.

Les tâches 1 et 2, elles, restent couvertes : le client HTTP, le jeton et le
dépôt distant n'ont besoin d'aucun rendu.

- [ ] **Étape 7 : éprouver à la main, serveur éteint**

Serveur lancé, panneau ouvert, capturer une idée : elle apparaît. Puis arrêter
le serveur (`Ctrl+C`) et capturer une seconde idée.

Attendu : le champ **garde son texte**, l'alerte s'affiche, _Réessayer_ est
proposé. Relancer le serveur, cliquer _Réessayer_ : l'idée part et le champ se
vide.

C'est la vérification qui compte le plus de toute la brique.

- [ ] **Étape 8 : typecheck, lint, format, tests**

Run : `pnpm typecheck && pnpm lint && pnpm exec prettier --check . && pnpm test`

- [ ] **Étape 9 : commit (PO)**

```
feat(extension): surface failures without losing what was typed

The composer used to clear its field synchronously, before the call it starts
even resolves — harmless against chrome.storage, fatal against a network. It
now clears only once the server has confirmed.
```

---

## Tâche 5 : documentation

- [ ] **Étape 1 : `tokens.css`**

Le commentaire de `--danger` dit _« reserved for destructive actions (delete) »_.
Le remplacer par : _« the only warm color: destructive actions, and failures the
user must notice »_.

- [ ] **Étape 2 : `structure.md`**

Déclarer `src/lib/` (avec `protocol.ts` et `filterIdeas.ts`, absent lui aussi),
les quatre fichiers de `src/background/`, `src/storage/remote.ts`,
`src/hooks/`, `src/screens/SignInScreen.tsx`, `src/components/Alert/`, et
`test/chromeRuntimeStub.ts`.

- [ ] **Étape 3 : `storage.md`**

Ajouter que le front lit désormais l'API, que `IdeaRepository` a deux
implémentations, et que la locale ne subsiste que pour la reprise à venir.

- [ ] **Étape 4 : `CLAUDE.md`**

La section Stack dit _« Stockage : `chrome.storage.local` derrière une couche
repository »_. Elle devient : l'API, via le service worker ; le stockage local ne
sert plus qu'à la reprise.

- [ ] **Étape 5 : `README.md`**

Ajouter que l'extension exige l'API démarrée, et la manière de fabriquer un
jeton tant que Google n'est pas branché.

- [ ] **Étape 6 : vérifier**

Run : `pnpm exec prettier --check . && pnpm test`

- [ ] **Étape 7 : commit (PO)**

```
docs: describe the extension talking to the api
```

---

## Notes / Blocage

- **Les composants React ne sont pas testés.** La pile ne contient pas de
  bibliothèque de rendu. La règle « un texte saisi ne disparaît jamais » est donc
  vérifiée à la main (tâche 4, étape 7) et par rien d'autre. Ajouter
  `@testing-library/react` est une décision PO.
- **`src/storage/types.ts` duplique le modèle du contrat**, à la main. La dérive
  devient un risque d'exécution maintenant que le front parle à l'API — traité
  par la brique de génération ci-dessous.
- **Types générés depuis le contrat : décision prise (option A), à faire
  **après** cette brique.** `openapi-typescript` lira `docs/openapi.yaml` pour
  produire les types du front et typer les chemins du client — ce qui supprime
  du même coup la duplication de `src/storage/types.ts`. Demande une
  installation à la racine, donc les mains du PO.

## Ce que ce plan ne fait pas

- **Le parcours Google** et la reconnexion silencieuse.
- **Le script de reprise** des idées du stockage local.
- **L'hébergement OVH** : l'adresse de l'API reste une constante.
- **L'écriture hors ligne et la synchronisation.**
- **La génération des types du front** depuis `docs/openapi.yaml`.
