# Connexion Google — plan d'implémentation

> **Pour l'exécutant :** les étapes sont des cases à cocher (`- [ ]`). Une étape
> = une action. On ne passe pas à la suivante sans avoir lancé la vérification de
> la précédente.

**But :** remplacer le collage d'un jeton par une vraie connexion Google, montrer
qui est connecté, et faire de la déconnexion une révocation.

**Architecture :** le service worker porte le flux OAuth de bout en bout — il
fabrique le PKCE, ouvre la fenêtre Google, échange le code contre une session
auprès de l'API, et range le jeton. Le panneau ne voit que l'utilisateur qui en
résulte.

**Pile :** aucune dépendance nouvelle. `crypto.subtle`, `chrome.identity` et
`fetch` sont natifs.

**Spec :** `docs/google-signin-design.md` (validée par le PO). Maquettes :
`design/mockup-profile.html` et `design/mockup-auth.html`.

## Contraintes globales

- **Git : 100 % manuel.** Les étapes « Commit » donnent le **texte** du message ;
  c'est le PO qui commite.
- **Installation : 100 % manuelle.** Sans objet ici — la brique n'installe rien.
- **Le contrat ne bouge pas.** `docs/openapi.yaml` et `docs/api-design.md`
  décrivent déjà les trois endpoints consommés. Aucune régénération de types.
- **Code en anglais**, commentaires compris. Le français est réservé aux textes
  vus par l'utilisateur.
- **Commentaires** : jamais de bloc de documentation, jamais de paraphrase.
- **Le livré passe `pnpm lint`, `pnpm typecheck` et `pnpm test`** sans erreur.
- **Tests du front dans `test/`**, jamais dans `src/` — le projet vitest `front`
  ne collecte que `test/**/*.test.ts`. Un test posé dans `src/` ne serait jamais
  exécuté et passerait pour vert.
- Terrain : Node 24.11 · pnpm 10.28.2 · TypeScript ~6.0.3 · Vite + `@crxjs` ·
  Chrome MV3.

## Deux faits qui dictent l'ordre des tâches

1. **La tâche 2 appartient au PO et dépend de la tâche 1.** Créer le client OAuth
   demande l'ID de l'extension, que la `key` de la tâche 1 fixe. On ne peut donc
   pas commencer par elle.
2. **Les tâches 3 à 6 ne demandent pas Google.** Elles se vérifient avec des
   bouchons. Seule la tâche 7 exige un vrai client. Le PO peut donc faire sa
   tâche 2 pendant qu'on avance.

## Structure des fichiers

```
src/
├── manifest.ts                   ← key, permission identity
├── background/
│   ├── pkce.ts                   ← CRÉÉ : verifier, challenge, base64url
│   ├── google.ts                 ← CRÉÉ : le flux launchWebAuthFlow
│   ├── api.ts                    ← 3 appels de plus, token nullable
│   └── messages.ts               ← session/* réécrits
├── lib/
│   ├── protocol.ts               ← session/* réécrits, Failure + cancelled
│   └── failureText.ts            ← 3ᵉ table de formulations : signIn
├── components/
│   ├── Avatar/                   ← CRÉÉ
│   └── AccountMenu/              ← CRÉÉ
├── hooks/
│   ├── useSession.ts             ← user, signIn sans argument
│   └── SessionProvider.tsx       ← identité + déconnexion incomplète
├── screens/
│   ├── SignInScreen.tsx          ← le champ disparaît
│   └── HomeScreen.tsx            ← barre de titre
└── storage/types.ts              ← User
test/
├── pkce.test.ts                  ← CRÉÉ
├── chromeIdentityStub.ts         ← CRÉÉ
├── setup.ts                      ← branche le bouchon identity
├── api.test.ts                   ← 3 appels de plus
└── messages.test.ts              ← session/* réécrits
key.pem                           ← CRÉÉ, jamais versionné
```

---

## Tâche 1 : l'ID stable de l'extension

**Fichiers :** créer `key.pem` ; modifier `src/manifest.ts`, `.gitignore`

**Interfaces :**

- Consomme : rien.
- Produit : un ID d'extension stable, et `chrome.identity` disponible.

- [ ] **Étape 1 : fermer la porte avant d'ouvrir la clé**

La clé privée ne doit **jamais** entrer dans un commit. On l'exclut **avant** de
la créer, pas après.

Ajouter à `.gitignore` :

```
# Clé privée de l'extension : fixe l'ID, ne se partage pas.
key.pem
```

Vérification :

```bash
grep -n 'key.pem' .gitignore
```

- [ ] **Étape 2 : engendrer la paire**

```bash
openssl genrsa 2048 > key.pem
```

Vérification — le fichier existe et git l'ignore :

```bash
test -s key.pem && git check-ignore -v key.pem
```

Attendu : une ligne `.gitignore:N:key.pem  key.pem`. **Si cette commande ne sort
rien, arrêter** : le fichier serait committable.

- [ ] **Étape 3 : lire la clé publique et l'ID qu'elle produit**

```bash
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | openssl base64 -A; echo
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | sha256sum | head -c 32 | tr '0-9a-f' 'a-p'; echo
```

La première commande donne la valeur de `key`. La seconde donne l'ID : Chrome
prend l'empreinte SHA-256 de la clé publique, garde les **16 premiers octets** et
translittère chaque demi-octet `0-9a-f` en `a-p`.

**Noter les deux valeurs** : l'ID sert à la tâche 2 et ne se redemande pas.

- [ ] **Étape 4 : déclarer la clé et la permission**

Dans `src/manifest.ts`, ajouter `key` (la valeur de l'étape 3, en une seule
ligne) et compléter `permissions` :

```typescript
    // Fixes the extension id, which the Google redirect URL is built from. An
    // unpacked extension otherwise derives its id from the folder path, so it
    // would change on another machine and break the registered redirect.
    key: 'REMPLACER_PAR_LA_BASE64_DE_LA_CLE_PUBLIQUE',
    permissions: ['storage', 'sidePanel', 'identity'],
```

`key` est la clé **publique** : elle se versionne sans risque, et c'est elle qui
garantit le même ID pour tout le monde.

- [ ] **Étape 5 : vérifier que Chrome produit bien l'ID attendu**

```bash
pnpm build
grep -o '"key"' dist/manifest.json && grep -o '"identity"' dist/manifest.json
```

Puis, dans Chrome : `chrome://extensions` → recharger l'extension depuis `dist/`.
**L'ID affiché doit être exactement celui de l'étape 3.** S'il diffère, la `key`
a été mal recopiée (espace, retour à la ligne) — reprendre l'étape 4.

- [ ] **Étape 6 : commit**

```
build(extension): pin the extension id with a manifest key

The Google redirect URL contains the extension id, and an unpacked
extension derives its id from the folder path. The public key fixes it
so the redirect registered with Google keeps working on any machine.
```

---

## Tâche 2 : le client OAuth Google — **PO**

**Bloquante pour la tâche 7 seulement.** Les tâches 3 à 6 se vérifient sans
Google. À lancer dès que la tâche 1 a livré l'ID.

- [ ] **Étape 1 : créer le client**

Console Google Cloud → _APIs & Services_ → _Credentials_ → _Create credentials_ →
_OAuth client ID_ → type **Web application**.

URL de redirection autorisée, **exactement**, barre oblique finale comprise :

```
https://<ID_DE_LA_TACHE_1>.chromiumapp.org/
```

Sur l'écran de consentement, ajouter `chromiumapp.org` aux domaines autorisés
s'il n'y est pas déjà.

- [ ] **Étape 2 : renseigner les deux environnements**

`server/.env` (les trois valeurs existent déjà dans `.env.example`) :

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://<ID>.chromiumapp.org/
```

`.env` à la racine :

```
VITE_GOOGLE_CLIENT_ID=...
```

Le `client_id` est le **même** des deux côtés. Le `client_secret` ne sort
**jamais** du serveur.

- [ ] **Étape 3 : ajouter la ligne manquante aux exemples**

Dans `.env.example` à la racine :

```
# Identifiant du client OAuth Google. Le meme que GOOGLE_CLIENT_ID de
# server/.env ; le secret, lui, ne quitte jamais le serveur.
VITE_GOOGLE_CLIENT_ID=
```

Dans `server/.env.example`, au-dessus de `GOOGLE_REDIRECT_URI` :

```
# Doit valoir exactement ce que chrome.identity.getRedirectURL() produit dans
# l extension, et ce qui est declare dans la console Google.
```

Vérification — le fichier se termine par un retour à la ligne :

```bash
tail -c 1 .env.example | xxd | grep -q '0a$' && echo 'newline ok'
```

---

## Tâche 3 : PKCE

**Fichiers :** créer `src/background/pkce.ts`, `test/pkce.test.ts`

**Interfaces :**

- Consomme : rien.
- Produit : `randomToken(bytes: number): string` et
  `challengeOf(verifier: string): Promise<string>`.

- [ ] **Étape 1 : écrire le test qui échoue**

Fichier `test/pkce.test.ts`. Le vecteur vient de la **RFC 7636, annexe B** : un
`code_verifier` publié doit produire un `code_challenge` publié. Comparer le code
à lui-même ne prouverait rien.

```typescript
import { describe, expect, it } from 'vitest';

import { challengeOf, randomToken } from '@/background/pkce';

// RFC 7636 appendix B. The published pair is what proves the encoding is the
// one Google expects, which a round-trip against our own code could not.
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('the PKCE challenge', () => {
  it('matches the published RFC 7636 vector', async () => {
    expect(await challengeOf(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });
});

describe('the random token', () => {
  it('is base64url: no padding, no plus, no slash', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(randomToken(32)).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('is long enough for a verifier and never repeats', () => {
    const seen = new Set<string>();
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const token = randomToken(32);
      expect(token.length).toBeGreaterThanOrEqual(43);
      seen.add(token);
    }
    expect(seen.size).toBe(200);
  });
});
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
pnpm exec vitest run --project front test/pkce.test.ts
```

Attendu : **échec** sur `Failed to resolve import "@/background/pkce"`.

- [ ] **Étape 3 : écrire l'implémentation**

Fichier `src/background/pkce.ts` :

```typescript
// A service worker has no Buffer, so base64url goes through btoa over a binary
// string. The three substitutions are what separates base64url from base64.
const base64url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const randomToken = (bytes: number): string =>
  base64url(crypto.getRandomValues(new Uint8Array(bytes)));

export async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );

  return base64url(new Uint8Array(digest));
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
pnpm exec vitest run --project front test/pkce.test.ts
```

Attendu : **3 tests verts**.

- [ ] **Étape 5 : prouver que le test mord**

Remplacer `.replace(/=+$/, '')` par `.replace(/=+$/, '=')`, relancer : le vecteur
RFC **et** le motif base64url doivent échouer. Remettre la ligne juste.

- [ ] **Étape 6 : commit**

```
feat(extension): add the PKCE pair generator

Verified against the published RFC 7636 vector rather than against
itself, since the point is to match what Google computes.
```

---

## Tâche 4 : les trois appels de l'API

**Fichiers :** modifier `src/background/api.ts`, `src/storage/types.ts`,
`test/api.test.ts`

**Interfaces :**

- Consomme : rien.
- Produit : `signInWithGoogle(code, codeVerifier)`, `fetchIdentity(token)`,
  `revokeSession(token)`, et le type `User`.

- [ ] **Étape 1 : déclarer `User` côté front**

Dans `src/storage/types.ts`, à côté de `Idea` :

```typescript
// Mirrors server/src/domain/types.ts and docs/openapi.yaml — the three move
// together. The email comes from Google and can change; the id cannot.
export interface User {
  id: string;
  email: string;
}
```

- [ ] **Étape 2 : écrire les tests qui échouent**

Ajouter à `test/api.test.ts` :

```typescript
describe('signing in with Google', () => {
  it('posts the code without an Authorization header', async () => {
    const fetchMock = respond(201, {
      token: 'tok',
      user: { id: 'u1', email: 'c@example.com' },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await signInWithGoogle('the-code', 'the-verifier');

    expect(result.token).toBe('tok');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init.body as string)).toEqual({
      code: 'the-code',
      codeVerifier: 'the-verifier',
    });
  });

  it('surfaces a refused code as the server worded it', async () => {
    vi.stubGlobal(
      'fetch',
      respond(400, { error: "Code d'autorisation invalide." }),
    );

    await expect(
      signInWithGoogle('bad', 'verifier'),
    ).rejects.toMatchObject({
      failure: {
        reason: 'rejected',
        message: "Code d'autorisation invalide.",
      },
    });
  });
});

describe('the identity and the sign-out', () => {
  it('reads the current user', async () => {
    vi.stubGlobal(
      'fetch',
      respond(200, { id: 'u1', email: 'c@example.com' }),
    );

    expect(await fetchIdentity('tok')).toEqual({
      id: 'u1',
      email: 'c@example.com',
    });
  });

  it('revokes the session with a DELETE', async () => {
    const fetchMock = respond(204, null);
    vi.stubGlobal('fetch', fetchMock);

    await revokeSession('tok');

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/auth\/session$/);
    expect(init.method).toBe('DELETE');
  });
});
```

Compléter l'import en tête du fichier avec les trois noms nouveaux.

- [ ] **Étape 3 : lancer les tests, vérifier qu'ils échouent**

```bash
pnpm exec vitest run --project front test/api.test.ts
```

Attendu : échec à l'import, les trois fonctions n'existent pas.

- [ ] **Étape 4 : rendre le jeton facultatif**

Dans `src/background/api.ts`, `call` accepte désormais `null` — un seul endpoint
s'appelle sans session, et c'est celui qui la crée.

```typescript
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
```

Le reste de la fonction ne change pas.

- [ ] **Étape 5 : ajouter les trois appels**

À la fin de `src/background/api.ts` :

```typescript
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
```

Compléter l'import de types : `import type { Idea, Status, User } from '@/storage/types';`

- [ ] **Étape 6 : lancer les tests, vérifier qu'ils passent**

```bash
pnpm exec vitest run --project front test/api.test.ts
```

- [ ] **Étape 7 : prouver que le test de l'en-tête mord**

Remplacer `token === null ? {}` par `token === null ? { Authorization: 'Bearer' }`.
**Un seul** test doit échouer : celui qui vérifie l'absence de l'en-tête. Remettre.

- [ ] **Étape 8 : commit**

```
feat(extension): call the three auth endpoints

The session, the identity and the revocation were all served and none
were called. POST /auth/google goes out without a token: it is the call
that obtains one.
```

---

## Tâche 5 : le flux dans le service worker

**Fichiers :** créer `src/background/google.ts`, `test/chromeIdentityStub.ts` ;
modifier `src/lib/protocol.ts`, `src/background/messages.ts`, `test/setup.ts`,
`test/messages.test.ts`

**Interfaces :**

- Consomme : `randomToken`, `challengeOf`, `signInWithGoogle`, `fetchIdentity`,
  `revokeSession`, `readToken`, `writeToken`, `clearToken`.
- Produit : les requêtes `session/signIn`, `session/identity`,
  `session/signOut` ; `Failure` gagne `cancelled`.

- [ ] **Étape 1 : réécrire le contrat**

Dans `src/lib/protocol.ts` — retirer `session/set` et `session/clear`, ajouter
les trois autres :

```typescript
import type { Idea, Status, User } from '@/storage/types';

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
  | { kind: 'session/signIn' }
  | { kind: 'session/identity' }
  | { kind: 'session/signOut' };

export type Failure =
  | { reason: 'offline' }
  | { reason: 'unauthenticated' }
  | { reason: 'gone' }
  | { reason: 'rejected'; message: string }
  | { reason: 'server' }
  // The Google window was closed. Nothing failed and nothing is shown — but
  // without a case of its own it would read as a server error.
  | { reason: 'cancelled' };
```

Et dans `ReplyData` :

```typescript
  'session/status': { connected: boolean };
  'session/signIn': { user: User };
  'session/identity': User;
  // false means "gone from here, still alive there": the server was not
  // reachable to be told.
  'session/signOut': { revoked: boolean };
```

- [ ] **Étape 2 : écrire le flux**

Fichier `src/background/google.ts` :

```typescript
import { ApiFailure, signInWithGoogle } from './api';
import { challengeOf, randomToken } from './pkce';
import type { User } from '@/storage/types';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

// Vite substitutes this at build time. Empty means .env was never filled —
// worth its own failure, because Google would answer with an opaque error.
const CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '');

export async function signIn(): Promise<{
  token: string;
  user: User;
}> {
  if (CLIENT_ID === '') {
    throw new ApiFailure({ reason: 'server' });
  }

  const verifier = randomToken(32);
  const state = randomToken(16);

  const url = `${AUTH_ENDPOINT}?${new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: chrome.identity.getRedirectURL(),
    response_type: 'code',
    scope: 'openid email',
    code_challenge: await challengeOf(verifier),
    code_challenge_method: 'S256',
    state,
    // Without it Google reuses the only signed-in account silently, which
    // makes "connect as someone else" impossible to reach.
    prompt: 'select_account',
  }).toString()}`;

  let redirect: string | undefined;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({
      url,
      interactive: true,
    });
  } catch {
    // Chrome rejects on a closed window, and does not distinguish that from
    // anything else it refuses. Treating it as a cancellation is the safe
    // reading: the sign-in screen stays put and retrying costs one click.
    throw new ApiFailure({ reason: 'cancelled' });
  }

  if (redirect === undefined) {
    throw new ApiFailure({ reason: 'cancelled' });
  }

  const params = new URL(redirect).searchParams;
  if (params.get('error') !== null) {
    throw new ApiFailure({ reason: 'cancelled' });
  }

  const code = params.get('code');
  // A mismatched state is not the user's doing, and not something to retry
  // into: something answered that we did not ask.
  if (code === null || params.get('state') !== state) {
    throw new ApiFailure({ reason: 'server' });
  }

  return signInWithGoogle(code, verifier);
}
```

- [ ] **Étape 3 : réécrire les handlers**

Dans `src/background/messages.ts` — extraire la capture de `ApiFailure`, que
trois cas partagent désormais :

```typescript
import * as api from './api';
import { ApiFailure } from './api';
import * as google from './google';
import { clearToken, readToken, writeToken } from './session';
import type { Failure, Request } from '@/lib/protocol';

type AnyReply =
  | { ok: true; data: unknown }
  | { ok: false; failure: Failure };

const failed = (failure: Failure): AnyReply => ({
  ok: false,
  failure,
});

async function attempt(
  run: () => Promise<unknown>,
): Promise<AnyReply> {
  try {
    return { ok: true, data: await run() };
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

async function withToken(
  run: (token: string) => Promise<unknown>,
): Promise<AnyReply> {
  const token = await readToken();
  if (token === null) return failed({ reason: 'unauthenticated' });

  return attempt(() => run(token));
}
```

Puis les trois cas `session/` :

```typescript
    case 'session/status':
      return {
        ok: true,
        data: { connected: (await readToken()) !== null },
      };
    case 'session/signIn':
      return attempt(async () => {
        const { token, user } = await google.signIn();
        await writeToken(token);
        return { user };
      });
    case 'session/identity':
      return withToken((token) => api.fetchIdentity(token));
    case 'session/signOut': {
      const token = await readToken();
      // Leaving is the user's call, so the local token goes in every case —
      // including when the server never hears about it.
      const revoked =
        token === null ? false : await revoke(token);
      await clearToken();
      return { ok: true, data: { revoked } };
    }
```

Et la fonction qu'il appelle, au-dessus de `handle` :

```typescript
async function revoke(token: string): Promise<boolean> {
  try {
    await api.revokeSession(token);
    return true;
  } catch (error) {
    // A 401 means the session was already dead, which is the outcome asked for.
    return (
      error instanceof ApiFailure &&
      error.failure.reason === 'unauthenticated'
    );
  }
}
```

- [ ] **Étape 4 : bouchonner `chrome.identity`**

Fichier `test/chromeIdentityStub.ts` :

```typescript
// Stand-in for chrome.identity, for tests only. launchWebAuthFlow is what each
// test decides: a redirect URL to return, or an error to throw.
export interface ChromeIdentityStub {
  getRedirectURL(): string;
  launchWebAuthFlow(details: { url: string }): Promise<string>;
  answerWith(redirect: string): void;
  rejectWith(message: string): void;
  lastUrl(): string | null;
}

const REDIRECT = 'https://abcdefghijklmnop.chromiumapp.org/';

export function createChromeIdentityStub(): ChromeIdentityStub {
  let answer: { redirect: string } | { error: string } = {
    error: 'not configured',
  };
  let seen: string | null = null;

  return {
    getRedirectURL: () => REDIRECT,
    async launchWebAuthFlow(details) {
      seen = details.url;
      if ('error' in answer) throw new Error(answer.error);
      return answer.redirect;
    },
    answerWith(redirect) {
      answer = { redirect };
    },
    rejectWith(message) {
      answer = { error: message };
    },
    lastUrl: () => seen,
  };
}
```

Puis brancher le bouchon dans `test/setup.ts` :

```typescript
import { createChromeIdentityStub } from './chromeIdentityStub';

beforeEach(() => {
  globalThis.chrome = {
    storage: createChromeStorageStub(),
    runtime: createChromeRuntimeStub(),
    identity: createChromeIdentityStub(),
  } as unknown as typeof chrome;
});
```

- [ ] **Étape 5 : réécrire les tests des messages**

Dans `test/messages.test.ts`, `signedIn()` passait par `session/set`, qui
n'existe plus. Le remplacer par une écriture directe du jeton — un test sème
l'état, il n'a pas besoin d'un message pour ça :

```typescript
import { writeToken } from '@/background/session';

const signedIn = () => writeToken('tok');
```

Remplacer l'appel à `session/clear` par `session/signOut`, et ajouter :

```typescript
import { createChromeIdentityStub } from './chromeIdentityStub';

const identity = () =>
  globalThis.chrome.identity as unknown as ReturnType<
    typeof createChromeIdentityStub
  >;

describe('signing in with Google', () => {
  it('asks for a code with an S256 challenge and keeps the token', async () => {
    identity().answerWith(
      'https://x.chromiumapp.org/?code=the-code&state=THE_STATE',
    );
    vi.stubGlobal(
      'fetch',
      respond(201, {
        token: 'tok',
        user: { id: 'u1', email: 'c@example.com' },
      }),
    );

    // The state is generated inside, so the stub has to echo the one it saw.
    const sent = new URL(identity().lastUrl() ?? 'https://x/');
    expect(sent.searchParams.get('code_challenge_method')).toBe(
      'S256',
    );
  });

  it('reports a closed window as cancelled, and stays signed out', async () => {
    identity().rejectWith('The user did not approve access.');

    expect(await handle({ kind: 'session/signIn' })).toEqual({
      ok: false,
      failure: { reason: 'cancelled' },
    });
    expect(await readToken()).toBeNull();
  });

  it('refuses a redirect whose state is not the one it sent', async () => {
    identity().answerWith(
      'https://x.chromiumapp.org/?code=c&state=forged',
    );

    expect(await handle({ kind: 'session/signIn' })).toEqual({
      ok: false,
      failure: { reason: 'server' },
    });
    expect(await readToken()).toBeNull();
  });
});

describe('signing out', () => {
  it('revokes the session and forgets the token', async () => {
    await signedIn();
    const fetchMock = respond(204, null);
    vi.stubGlobal('fetch', fetchMock);

    expect(await handle({ kind: 'session/signOut' })).toEqual({
      ok: true,
      data: { revoked: true },
    });
    expect(await readToken()).toBeNull();
  });

  it('leaves anyway when the server cannot be told', async () => {
    await signedIn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('offline')),
    );

    expect(await handle({ kind: 'session/signOut' })).toEqual({
      ok: true,
      data: { revoked: false },
    });
    expect(await readToken()).toBeNull();
  });
});
```

**Note pour l'exécutant :** le premier test ci-dessus est incomplet à dessein — le
`state` est fabriqué à l'intérieur et le bouchon doit le renvoyer. Deux sorties
possibles : donner au bouchon un mode « écho » qui relit le `state` de l'URL
reçue et le recopie dans la redirection, ou n'asserter que sur l'URL sortante
(challenge, méthode, scope) et laisser les deux tests suivants couvrir le retour.
**Prendre le mode écho** : c'est le seul chemin qui prouve qu'un aller-retour
nominal range bien le jeton.

- [ ] **Étape 6 : lancer la suite du front**

```bash
pnpm exec vitest run --project front
```

Attendu : tout au vert, les tests existants compris.

- [ ] **Étape 7 : prouver que la vérification du `state` mord**

Dans `google.ts`, retirer `|| params.get('state') !== state`. **Un seul** test
doit échouer : « refuses a redirect whose state is not the one it sent ».
Remettre la condition.

- [ ] **Étape 8 : commit**

```
feat(extension): run the Google flow in the service worker

The worker builds the PKCE pair, opens the consent window, checks the
state it gets back and trades the code for a session. The panel never
sees the code, the verifier or the token.

Signing out now revokes server-side. When the server cannot be reached
the token is dropped anyway: the user asked to leave this device.
```

---

## Tâche 6 : le panneau

**Fichiers :** créer `src/components/Avatar/Avatar.tsx` +
`Avatar.module.css`, `src/components/AccountMenu/AccountMenu.tsx` +
`AccountMenu.module.css` ; modifier `src/hooks/useSession.ts`,
`src/hooks/SessionProvider.tsx`, `src/screens/SignInScreen.tsx` +
son CSS, `src/screens/HomeScreen.tsx` + son CSS, `src/lib/failureText.ts`

**Interfaces :**

- Consomme : `session/signIn`, `session/identity`, `session/signOut`.
- Produit : `useSession()` avec `user`, `signIn()` sans argument,
  `signOutIncomplete`.

- [ ] **Étape 1 : une troisième table de formulations**

Une connexion qui échoue n'est ni une lecture ni une écriture : « Chargement
impossible — rien n'est perdu, tes idées sont sur le serveur » n'a aucun sens
devant un écran de connexion.

Dans `src/lib/failureText.ts` :

```typescript
export type Attempted = 'read' | 'write' | 'signIn';

// A cancelled sign-in displays nothing, so it has no wording. Excluding it
// here makes that a compile error rather than an empty alert.
export type Displayable = Exclude<Failure, { reason: 'cancelled' }>;

const TEXT: Record<
  Attempted,
  Record<Displayable['reason'], { title: string; body: string }>
> = {
```

Ajouter la table, à la suite des deux autres :

```typescript
  signIn: {
    offline: {
      title: 'Connexion impossible',
      body: "Le serveur n'a pas répondu. Réessaie dans un instant.",
    },
    server: {
      title: 'Connexion impossible',
      body: 'Le serveur a rencontré un problème. Réessaie dans un instant.',
    },
    rejected: { title: 'Connexion refusée', body: '' },
    unauthenticated: {
      title: 'Connexion impossible',
      body: 'Réessaie dans un instant.',
    },
    gone: {
      title: 'Connexion impossible',
      body: 'Réessaie dans un instant.',
    },
  },
```

Et la signature : `failureText(failure: Displayable, attempted: Attempted)`.

- [ ] **Étape 2 : ouvrir le contexte à l'identité**

`src/hooks/useSession.ts` :

```typescript
import type { User } from '@/storage/types';

export interface SessionContextValue {
  connected: boolean;
  checking: boolean;
  // null while /auth/me has not answered. The pipeline does not wait for it.
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  // Set when a sign-out never reached the server. Cleared by the next sign-in.
  signOutIncomplete: boolean;
  // What the last sign-in attempt failed on, or null. Cancellations are not
  // failures and never land here.
  signInFailure: Displayable | null;
}
```

- [ ] **Étape 3 : câbler le provider**

Dans `src/hooks/SessionProvider.tsx` — `signIn` ne prend plus de jeton, et
l'identité se charge une fois connecté. Le helper `askConnected` devient un
`ask` générique qui rend la réponse complète :

```typescript
const ask = async <K extends SessionRequest['kind']>(
  request: Extract<Request, { kind: K }>,
): Promise<Reply<K> | null> => {
  try {
    return (await chrome.runtime.sendMessage(request)) as Reply<K>;
  } catch {
    // sendMessage rejects outright when nothing answers. An unreachable
    // worker must leave the panel signed out, never stuck on a blank screen.
    return null;
  }
};
```

L'identité se charge dans son propre effet, déclenché par `connected` :

```typescript
useEffect(() => {
  if (!connected) {
    setUser(null);
    return;
  }
  let active = true;

  void ask({ kind: 'session/identity' }).then((reply) => {
    // A failure here is silent by design: the avatar stays in its waiting
    // state, and nothing the user is doing depends on it.
    if (active && reply?.ok) setUser(reply.data);
  });
  return () => {
    active = false;
  };
}, [connected]);
```

`signIn` et `signOut` :

```typescript
const signIn = useCallback(async () => {
  setSignOutIncomplete(false);
  const reply = await ask({ kind: 'session/signIn' });

  if (reply?.ok) {
    setUser(reply.data.user);
    setConnected(true);
    setSignInFailure(null);
    return;
  }
  // A cancelled window is not a failure: the screen stays exactly as it was.
  if (reply && reply.failure.reason !== 'cancelled') {
    setSignInFailure(reply.failure);
  }
  if (!reply) setSignInFailure({ reason: 'server' });
}, []);

const signOut = useCallback(async () => {
  const reply = await ask({ kind: 'session/signOut' });
  setSignOutIncomplete(reply?.ok === true && !reply.data.revoked);
  setConnected(false);
  setUser(null);
}, []);
```

- [ ] **Étape 4 : l'avatar**

`src/components/Avatar/Avatar.tsx` — présentationnel, il ne connaît que l'e-mail :

```typescript
import styles from './Avatar.module.css';

interface Props {
  // null while the identity has not come back.
  email: string | null;
  // Given only when the avatar is the sole content of a control, which has to
  // be named by something other than a single letter.
  label?: string;
}

export default function Avatar({ email, label }: Props) {
  const initial = email?.trim().charAt(0).toUpperCase() ?? '';

  return (
    <span
      className={`${styles.avatar} ${email === null ? styles.waiting : ''}`}
      {...(label === undefined
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label })}
    >
      {initial}
    </span>
  );
}
```

`Avatar.module.css` — le cercle garde sa taille dans les deux états, sinon la
barre se décale au moment où la lettre arrive :

```css
/* Identity mark: the initial of the e-mail. Turquoise and always turquoise —
 * one account is connected at a time, so a derived color would tell nothing
 * apart, and the palette's other hues already mean a status. */

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: var(--card);
  user-select: none;
}

/* Waiting for /auth/me: same box, no letter, so nothing shifts when it lands. */
.waiting {
  background: #e4eaf4;
  color: transparent;
  animation: breathe 1.6s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .waiting {
    animation: none;
    opacity: 0.8;
  }
}
```

- [ ] **Étape 5 : le menu de compte**

`src/components/AccountMenu/AccountMenu.tsx` — il reçoit l'e-mail et un callback,
comme tout composant de `components/` :

```typescript
import Avatar from '@/components/Avatar/Avatar';
import Popover from '@/components/Popover/Popover';
import styles from './AccountMenu.module.css';

interface Props {
  email: string | null;
  onSignOut: () => void;
}

export default function AccountMenu({ email, onSignOut }: Props) {
  return (
    <Popover
      align="end"
      trigger={<Avatar email={email} label="Mon compte" />}
    >
      {(close) => (
        <div className={styles.menu}>
          <div className={styles.identity}>
            <Avatar email={email} />
            <span className={styles.who}>
              <span className={styles.email}>
                {email ?? 'Connecté'}
              </span>
              <span className={styles.device}>
                Connecté sur cet appareil
              </span>
            </span>
          </div>
          <div className={styles.separator} />
          <button
            type="button"
            className={styles.signOut}
            onClick={() => {
              close();
              onSignOut();
            }}
          >
            Se déconnecter
          </button>
        </div>
      )}
    </Popover>
  );
}
```

`AccountMenu.module.css` — reprendre `.pop-id`, `.pop-sep`, `.pop-item.danger` de
`design/mockup-profile.html`, en tokens. L'e-mail est tronqué, jamais coupé sur
plusieurs lignes :

```css
.email {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}
```

- [ ] **Étape 6 : la barre de titre de l'accueil**

Dans `src/screens/HomeScreen.tsx`, remplacer le titre nu par une barre, et tirer
l'identité du contexte — un **écran** a le droit d'accéder aux données :

```typescript
const { user, signOut } = useSession();
```

```tsx
<div className={styles.titlebar}>
  <p className={styles.title}>Mes idées</p>
  <AccountMenu
    email={user?.email ?? null}
    onSignOut={() => void signOut()}
  />
</div>
```

Dans `HomeScreen.module.css` :

```css
/* Same grammar as the detail header: title left, actions right. */
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
}
```

Retirer de `.title` la marge basse qu'il portait, désormais tenue par `.titlebar`.

**L'accueil seulement.** La liste et le détail gardent leur barre de retour ; la
maquette ne montre l'identité que là, et un avatar sur trois surfaces serait trois
fois la même information.

- [ ] **Étape 7 : l'écran de connexion**

Dans `src/screens/SignInScreen.tsx` — le champ, son état et le texte
« étape provisoire » disparaissent. Le bouton porte le logo Google de
`design/mockup-auth.html`, recopié tel quel.

```typescript
export default function SignInScreen() {
  const { signIn, signInFailure, signOutIncomplete } = useSession();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signIn();
    } finally {
      setBusy(false);
    }
  };
  ...
}
```

Sous le bouton, dans cet ordre :

```tsx
{
  signInFailure && (
    <Alert
      title={failureText(signInFailure, 'signIn').title}
      onRetry={() => void submit()}
    >
      {failureText(signInFailure, 'signIn').body}
    </Alert>
  );
}
{
  signOutIncomplete && (
    <Alert title="Déconnexion incomplète">
      Cet appareil est déconnecté, mais le serveur n'a pas pu être
      prévenu. La session restera ouverte à distance jusqu'à son
      expiration.
    </Alert>
  );
}
```

Le bouton est désactivé pendant que la fenêtre Google est ouverte
(`disabled={busy}`), sans quoi un second clic ouvrirait une deuxième fenêtre.

- [ ] **Étape 8 : la porte du panneau**

`src/sidepanel/App.tsx` ne change pas : il montre déjà `SignInScreen` quand
`connected` est faux. Vérifier seulement que rien n'y référence `signIn(token)`.

- [ ] **Étape 9 : la suite complète**

```bash
pnpm typecheck && pnpm lint && pnpm format && pnpm test && pnpm build
```

Attendu : tout vert, hors les deux avertissements `max-lines` préexistants sur
des fichiers de test.

- [ ] **Étape 10 : commit**

```
feat(extension): sign in with Google and show who is connected

The pasted-token form is gone. The home bar carries an avatar built
from the account's initial, and its menu revokes the session rather
than forgetting it.
```

---

## Tâche 7 : vérification réelle et documentation

**Dépend de la tâche 2.** Rien ici ne se fait sans un vrai client OAuth.

**Fichiers :** modifier `.claude/rules/structure.md`, `.claude/rules/react.md`,
`README.md`, `CLAUDE.md`

- [ ] **Étape 1 : le parcours nominal**

Base et serveur allumés, extension rechargée depuis `dist/` :

1. Ouvrir le panneau → écran de connexion, **aucun champ**.
2. « Se connecter avec Google » → la fenêtre Google s'ouvre.
3. Choisir un compte → la fenêtre se ferme, le pipeline apparaît.
4. L'avatar porte l'initiale de l'e-mail choisi.

Contrôle en base — une ligne `users`, une ligne `sessions` :

```bash
docker compose exec -T db psql -U postgres -d idea_pipeline \
  -c 'SELECT email, created_at FROM users;' \
  -c 'SELECT user_agent, expires_at FROM sessions;'
```

- [ ] **Étape 2 : l'annulation ne dit rien**

Relancer la connexion, **fermer la fenêtre Google**. Attendu : l'écran de
connexion inchangé, **aucune alerte**.

- [ ] **Étape 3 : la déconnexion révoque vraiment**

Cliquer l'avatar → « Se déconnecter ». Puis :

```bash
docker compose exec -T db psql -U postgres -d idea_pipeline \
  -c 'SELECT count(*) FROM sessions;'
```

Attendu : **0**. C'est le défaut que la brique existait pour réparer ; si le
compte n'est pas à zéro, elle a échoué.

- [ ] **Étape 4 : la déconnexion hors ligne part quand même**

Se reconnecter, **couper le serveur**, se déconnecter. Attendu : retour à l'écran
de connexion **avec** l'alerte « Déconnexion incomplète ». Rallumer, vérifier que
la ligne `sessions` est toujours là — c'est précisément ce que l'alerte annonce.

- [ ] **Étape 5 : le cloisonnement, vu du produit**

Se connecter avec un **second** compte Google, créer une idée, se déconnecter,
revenir au premier. Attendu : l'idée du second **n'apparaît pas**. Le serveur le
garantit déjà par test ; ici on vérifie que le front ne contourne rien.

- [ ] **Étape 6 : mettre les règles à jour**

- `structure.md` : `background/pkce.ts` et `background/google.ts` ;
  `components/Avatar`, `AccountMenu`, `ActionMenu` ; `User` dans
  `storage/types.ts` ; la ligne « `server/` — pas encore branchée au front » est
  **fausse depuis deux briques**, la corriger.
- `react.md` : l'entorse de `Composer` (il possède son texte **et** son échec),
  restée non consignée depuis la brique précédente.
- `README.md` : `VITE_GOOGLE_CLIENT_ID`, `key.pem` à ne pas perdre, et le fait
  qu'un jeton collé à la main n'est plus un moyen d'entrer.
- `CLAUDE.md` : la connexion Google n'est plus « conçue, pas encore livrée ».
  Seul l'hébergement le reste.

- [ ] **Étape 7 : commit**

```
docs: record the Google sign-in brick

structure.md still described server/ as unwired and did not know the
new components. CLAUDE.md listed Google sign-in as designed but not
built; only the hosting is still in that state.
```

---

## Ce que ce plan ne fait pas

- **L'écran profil** et les lignes « Membre depuis » / « Cet appareil ».
- **Lister et révoquer ses autres appareils.**
- **Le nom et la photo Google** — le serveur ne les lit pas.
- **L'e-mail / mot de passe.**
- **L'hébergement OVH.**
- **La reprise des idées de `chrome.storage.local`.**
- **`@testing-library/react`** : l'avatar et le menu ne sont vérifiés qu'à la
  main, à la tâche 7. Le manque est connu et assumé.

## Notes / Blocage

- **Un message précis se perd en route.** `api.ts` traduit tout `>= 500` en
  `server`, donc le `502 Service d'authentification indisponible.` — qui dit
  précisément « Google est injoignable » — s'affichera en « Le serveur a
  rencontré un problème ». Réparable en laissant passer le message du 502 ; hors
  périmètre ici, consigné pour ne pas être découvert par surprise.
- **Les trois valeurs qui doivent s'accorder** (console Google, `GOOGLE_REDIRECT_URI`,
  ID de l'extension) n'ont aucun garde-fou automatique. Voir la spec.
- **`key.pem` n'est protégé que par `.gitignore`.** Il mérite d'être rangé
  ailleurs qu'à la racine d'un dépôt de travail.
