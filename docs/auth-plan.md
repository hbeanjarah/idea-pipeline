# Authentification & cloisonnement — plan d'implémentation

> **Pour l'exécutant :** les étapes sont des cases à cocher (`- [ ]`). Une étape
> = une action. On ne passe pas à la suivante sans avoir lancé la vérification de
> la précédente.

**But :** donner à l'API des comptes Google, des sessions révocables et un
cloisonnement étanche entre utilisateurs.

**Architecture :** une session est un jeton opaque dont seul le **hash** est
stocké. Un middleware le résout en `userId`, que chaque couche transmet
explicitement jusqu'au store, où il devient un `WHERE user_id = $1`. L'échange
du code Google se fait côté serveur, isolé derrière un module que les tests
remplacent.

**Pile :** aucune dépendance nouvelle — `fetch` est natif en Node 24,
`node:crypto` fournit l'aléa et le hachage.

**Spec :** `docs/auth-design.md` (validée par le PO). Les deux se lisent ensemble.

## Contraintes globales

- **Git : 100 % manuel.** Les étapes « Commit » donnent le **texte** du message ;
  c'est le PO qui commite.
- **Installation : 100 % manuelle.** Sans objet ici — la brique n'installe rien.
- **Contrat d'abord.** `docs/openapi.yaml` est la source du modèle : on l'édite,
  on régénère (`pnpm --dir server generate:types`), **puis** on code.
- **Code en anglais**, commentaires compris. Le français est réservé aux messages
  d'erreur de l'API, repris mot pour mot de `docs/api-design.md`.
- **Commentaires** : jamais de bloc de documentation, jamais de paraphrase.
- **Le livré passe `pnpm lint`, `pnpm typecheck` et `pnpm test`** sans erreur.
- **Durées de session actées** : 30 jours en absolu, 7 jours d'inactivité.
- Terrain : Node 24.11 · pnpm 10.28.2 · TypeScript ~6.0.3 · PostgreSQL 17.

## Deux faits vérifiés qui dictent le plan

1. **`vi.mock` fonctionne sur un alias `#`** — sondé dans une session précédente
   avec un module jetable. La tâche 5 s'appuie dessus.
2. **Le test de dérive de contrat cassera** dès que le spec gagnera un chemin
   `/auth/*` : `declaredOperations()` lit **toute** la section `paths:`, alors que
   `mountedOperations()` ne lit que `ideasRouter`. Il est généralisé en tâche 3,
   dans le même mouvement que le premier chemin `/auth`.

## Structure des fichiers

| Fichier                                                                     | Rôle                                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `server/migrations/002_auth.sql`                                            | **créer** — `users`, `sessions`, `ideas.user_id`                      |
| `server/src/store/users.ts`                                                 | **créer** — `upsertUser`                                              |
| `server/src/store/sessions.ts`                                              | **créer** — création, résolution, révocation                          |
| `server/src/middleware/auth.ts`                                             | **créer** — `requireSession`, `userIdOf`                              |
| `server/src/config/google.ts`                                               | **créer** — l'échange du code, seul point qui parle à Google          |
| `server/src/routes/auth.ts`                                                 | **créer** — `/auth/*`                                                 |
| `server/src/controllers/auth.ts`                                            | **créer**                                                             |
| `server/src/services/auth.ts`                                               | **créer**                                                             |
| `server/src/routes/contract.test.ts`                                        | **créer** — remplace `routes/ideas.test.ts`, couvre les deux routeurs |
| `server/src/isolation.test.ts`                                              | **créer** — la preuve du cloisonnement                                |
| `server/test/factories.ts`                                                  | **créer** — fabrique un utilisateur et sa session                     |
| `server/src/store/ideas.ts`                                                 | **modifier** — `userId` en 1er paramètre des 6                        |
| `server/src/services/ideas.ts`                                              | **modifier** — idem                                                   |
| `server/src/controllers/ideas.ts`                                           | **modifier** — lisent `userIdOf(req)`                                 |
| `server/src/app.ts`                                                         | **modifier** — monte `/auth`, protège `/ideas`                        |
| `server/test/setup.ts`                                                      | **modifier** — `TRUNCATE` étendu                                      |
| `server/src/app.test.ts` · `services/ideas.test.ts` · `store/ideas.test.ts` | **modifier** — tous authentifiés                                      |
| `docs/openapi.yaml` · `docs/api-design.md`                                  | **modifier** — le contrat                                             |

---

## Tâche 0 : le client OAuth Google (PO)

**Non bloquante** jusqu'à la tâche 6 : les tâches 1 à 5 se vérifient sans Google,
dont l'échange est simulé. À lancer en parallèle.

- [ ] **Étape 1 : créer le client**

Dans la console Google Cloud → _APIs & Services_ → _Credentials_ → _Create
credentials_ → _OAuth client ID_ → type **Web application**.

URL de redirection autorisée : `https://<ID_EXTENSION>.chromiumapp.org/`

L'ID de l'extension doit être **stable**, ce qui suppose une `key` fixée dans
`src/manifest.ts` — sujet de la brique extension. En attendant, n'importe quelle
valeur permet de créer le client ; elle se corrige plus tard.

- [ ] **Étape 2 : renseigner l'environnement**

Ajouter à `server/.env.example` :

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

Puis reporter les vraies valeurs dans `server/.env`, **jamais** versionné.

---

## Tâche 1 : le modèle

**Fichiers :** créer `server/migrations/002_auth.sql`

**Interfaces :**

- Consomme : la base migrée de la brique persistance.
- Produit : les tables `users` et `sessions`, la colonne `ideas.user_id`, et les
  types régénérés dans `schema.generated.ts`.

- [ ] **Étape 1 : écrire la migration**

Fichier `server/migrations/002_auth.sql` :

```sql
CREATE TABLE users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub  text        NOT NULL UNIQUE,
  email       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    text        NOT NULL UNIQUE,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Base de développement uniquement : rien n'est déployé, et ces lignes sont des
-- tests. Une migration destructrice serait inacceptable sur un système en
-- service — ne pas recopier ce DELETE ailleurs sans y réfléchir.
DELETE FROM ideas;

ALTER TABLE ideas ADD COLUMN user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE;

CREATE INDEX ideas_user_id_updated_at_idx ON ideas (user_id, updated_at DESC, id DESC);
DROP INDEX ideas_updated_at_idx;  -- plus aucune requête ne liste sans filtrer sur user_id
```

- [ ] **Étape 2 : appliquer et régénérer**

Run :

```bash
docker compose up -d --wait
pnpm --dir server db:migrate
pnpm --dir server db:types
```

Attendu : `Applied: 002_auth.sql`, puis `Introspected 5 tables`.

- [ ] **Étape 3 : vérifier le schéma réel**

Run :

```bash
docker compose exec -T db psql -U idea -d idea_pipeline -c '\d ideas' -c '\d sessions'
```

Attendu : `ideas.user_id` en `not null` avec sa clé étrangère `ON DELETE
CASCADE` ; l'index `ideas_user_id_updated_at_idx` présent et
`ideas_updated_at_idx` **absent** ; `sessions.token_hash` en `UNIQUE`.

- [ ] **Étape 4 : vérifier l'idempotence**

Run : `pnpm --dir server db:migrate`
Attendu : `No migration to apply.`

- [ ] **Étape 5 : constater la casse, elle est normale**

Run : `pnpm test`
Attendu : **ÉCHEC** massif — `ideas.user_id` est `NOT NULL` et aucun `INSERT` ne
le renseigne. C'est la tâche 4 qui répare. Ne rien corriger ici.

- [ ] **Étape 6 : commit (PO)**

```
feat(server): add users, sessions and idea ownership

The DELETE on ideas is safe only because nothing is deployed yet and those
rows are test data; postgres refuses a NOT NULL column without a default on
a populated table, and users is created empty by this same migration.
```

---

## Tâche 2 : les stores `users` et `sessions`

Pas d'HTTP, pas de contrat. Du SQL testable seul.

**Fichiers :** créer `server/src/store/users.ts`, `server/src/store/sessions.ts`,
`server/src/store/sessions.test.ts` ; modifier `server/test/setup.ts`

**Interfaces :**

- Consomme : `db()` depuis `#store/db`.
- Produit :
  - `upsertUser(googleSub: string, email: string): Promise<{ id: string; email: string }>`
  - `createSession(userId: string, userAgent: string | null): Promise<string>` — renvoie le **jeton en clair**, la seule fois où il existe
  - `resolveSession(token: string): Promise<string | null>` — renvoie le `userId`, et rafraîchit `last_seen_at`
  - `revokeSession(token: string): Promise<boolean>`

- [ ] **Étape 1 : étendre le nettoyage entre tests**

Dans `server/test/setup.ts`, remplacer la ligne du `TRUNCATE` par :

```typescript
await sql`TRUNCATE users, sessions, ideas, variations CASCADE`.execute(
  db(),
);
```

Sans `users`, un test laisserait derrière lui des comptes que le suivant
retrouverait.

- [ ] **Étape 2 : écrire le store des utilisateurs**

Fichier `server/src/store/users.ts` :

```typescript
import { db } from '#store/db';

export interface StoredUser {
  id: string;
  email: string;
}

export async function upsertUser(
  googleSub: string,
  email: string,
): Promise<StoredUser> {
  // Google is the authority on the address: a user who renames it must find the
  // same account, which is why the conflict target is the sub and not the email.
  const row = await db()
    .insertInto('users')
    .values({ google_sub: googleSub, email })
    .onConflict((conflict) =>
      conflict.column('google_sub').doUpdateSet({ email }),
    )
    .returning(['id', 'email'])
    .executeTakeFirstOrThrow();

  return row;
}
```

- [ ] **Étape 3 : écrire les tests de session (ils doivent échouer)**

Fichier `server/src/store/sessions.test.ts` :

```typescript
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { db } from '#store/db';
import * as sessions from '#store/sessions';
import { upsertUser } from '#store/users';

const aUser = () =>
  upsertUser(`sub-${crypto.randomUUID()}`, 'a@example.test');

describe('createSession', () => {
  it('hands back a token that resolves to its user', async () => {
    const user = await aUser();

    const token = await sessions.createSession(user.id, 'Chrome');

    expect(await sessions.resolveSession(token)).toBe(user.id);
  });

  it('never stores the token itself', async () => {
    const user = await aUser();

    const token = await sessions.createSession(user.id, null);

    const stored = await db()
      .selectFrom('sessions')
      .select('token_hash')
      .executeTakeFirstOrThrow();
    expect(stored.token_hash).not.toBe(token);
    expect(stored.token_hash).toHaveLength(64);
  });

  it('issues a different token every time', async () => {
    const user = await aUser();

    const first = await sessions.createSession(user.id, null);
    const second = await sessions.createSession(user.id, null);

    expect(first).not.toBe(second);
    // Two devices, two live sessions: that is the whole point.
    expect(await sessions.resolveSession(first)).toBe(user.id);
    expect(await sessions.resolveSession(second)).toBe(user.id);
  });
});

describe('resolveSession', () => {
  it('refuses an unknown token', async () => {
    expect(await sessions.resolveSession('nope')).toBeNull();
  });

  it('refuses a session past its absolute expiry', async () => {
    const user = await aUser();
    const token = await sessions.createSession(user.id, null);

    await sql`UPDATE sessions SET expires_at = now() - interval '1 second'`.execute(
      db(),
    );

    expect(await sessions.resolveSession(token)).toBeNull();
  });

  it('refuses a session left idle too long', async () => {
    const user = await aUser();
    const token = await sessions.createSession(user.id, null);

    await sql`UPDATE sessions SET last_seen_at = now() - interval '8 days'`.execute(
      db(),
    );

    expect(await sessions.resolveSession(token)).toBeNull();
  });

  it('pushes the idle deadline back on every use', async () => {
    const user = await aUser();
    const token = await sessions.createSession(user.id, null);

    await sql`UPDATE sessions SET last_seen_at = now() - interval '6 days'`.execute(
      db(),
    );
    await sessions.resolveSession(token);

    const { last_seen_at } = await db()
      .selectFrom('sessions')
      .select('last_seen_at')
      .executeTakeFirstOrThrow();
    expect(Date.now() - last_seen_at.getTime()).toBeLessThan(5000);
  });
});

describe('revokeSession', () => {
  it('kills the session immediately, and only that one', async () => {
    const user = await aUser();
    const kept = await sessions.createSession(user.id, null);
    const doomed = await sessions.createSession(user.id, null);

    expect(await sessions.revokeSession(doomed)).toBe(true);

    expect(await sessions.resolveSession(doomed)).toBeNull();
    expect(await sessions.resolveSession(kept)).toBe(user.id);
  });

  it('reports nothing to revoke on an unknown token', async () => {
    expect(await sessions.revokeSession('nope')).toBe(false);
  });
});
```

- [ ] **Étape 4 : lancer, vérifier l'échec**

Run : `pnpm test -- sessions`
Attendu : **ÉCHEC**, `Cannot find module '#store/sessions'`.

- [ ] **Étape 5 : écrire le store des sessions**

Fichier `server/src/store/sessions.ts` :

```typescript
import { createHash, randomBytes } from 'node:crypto';

import { sql } from 'kysely';

import { db } from '#store/db';

const ABSOLUTE_DAYS = 30;
const IDLE_DAYS = 7;

// The token carries 256 bits of entropy, so a fast hash is enough: slow hashing
// exists to protect low-entropy secrets a human chose, not random bytes.
const fingerprint = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export async function createSession(
  userId: string,
  userAgent: string | null,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');

  await db()
    .insertInto('sessions')
    .values({
      user_id: userId,
      token_hash: fingerprint(token),
      user_agent: userAgent,
      expires_at: sql<Date>`now() + make_interval(days => ${ABSOLUTE_DAYS})`,
    })
    .execute();

  // The only moment the plain token exists. It is never stored, never logged.
  return token;
}

export async function resolveSession(
  token: string,
): Promise<string | null> {
  // Validating and refreshing in one statement: the WHERE clause reads the row
  // as it was, so the idle check is not defeated by the update it guards.
  const rows = await sql<{ user_id: string }>`
    UPDATE sessions
       SET last_seen_at = now()
     WHERE token_hash = ${fingerprint(token)}
       AND expires_at > now()
       AND last_seen_at > now() - make_interval(days => ${IDLE_DAYS})
    RETURNING user_id
  `.execute(db());

  return rows.rows[0]?.user_id ?? null;
}

export async function revokeSession(token: string): Promise<boolean> {
  const result = await db()
    .deleteFrom('sessions')
    .where('token_hash', '=', fingerprint(token))
    .executeTakeFirst();

  return result.numDeletedRows > 0n;
}
```

- [ ] **Étape 6 : lancer, vérifier le vert**

Run : `pnpm test -- sessions`
Attendu : les 8 tests de `sessions.test.ts` passent. Les autres fichiers restent
rouges depuis la tâche 1 — c'est attendu.

- [ ] **Étape 7 : typecheck et format**

Run : `pnpm typecheck && pnpm exec prettier --check .`
Attendu : aucune erreur.

- [ ] **Étape 8 : commit (PO)**

```
feat(server): store users and revocable sessions

Only a sha256 fingerprint of the token is stored, so a database leak cannot
be replayed. Resolving a session validates and refreshes it in a single
statement, which keeps the idle check from being defeated by its own update.
```

---

## Tâche 3 : le middleware, deux endpoints, et le contrat

Le premier chemin `/auth` entre dans le spec : c'est ici que le test de dérive
est généralisé.

**Fichiers :** créer `server/src/middleware/auth.ts`, `server/src/routes/auth.ts`,
`server/src/controllers/auth.ts`, `server/src/services/auth.ts`,
`server/src/routes/contract.test.ts`, `server/test/factories.ts` ;
supprimer `server/src/routes/ideas.test.ts` ; modifier `server/src/app.ts`,
`docs/openapi.yaml`, `docs/api-design.md`

**Interfaces :**

- Consomme : `resolveSession`, `revokeSession` (tâche 2).
- Produit :
  - `requireSession: RequestHandler` — pose `req.userId` ou lève `401`
  - `userIdOf(req: Request): string`
  - `createUserWithSession(email?: string): Promise<{ userId: string; token: string }>` (fabrique de test)
  - `addDevice(userId: string): Promise<string>` — une seconde session pour le **même** compte

- [ ] **Étape 1 : le contrat d'abord — `docs/openapi.yaml`**

Ajouter, après le bloc `servers:`, en remplacement de `security: []` :

```yaml
security:
  - sessionToken: []
```

Ajouter sous `components:` (créer la clé `securitySchemes` si absente) :

```yaml
securitySchemes:
  sessionToken:
    type: http
    scheme: bearer
    description: |
      Jeton de session opaque, obtenu par `POST /auth/google`.
      Révocable : supprimer la session le rend immédiatement invalide.
```

Ajouter au schéma `User` sous `components.schemas` :

```yaml
User:
  type: object
  additionalProperties: false
  required: [id, email]
  properties:
    id:
      type: string
      format: uuid
    email:
      type: string
      format: email
```

Ajouter les deux chemins dans `paths:` :

```yaml
/auth/me:
  get:
    operationId: getCurrentUser
    summary: Le compte associé à la session courante
    responses:
      '200':
        description: La session est valide.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/User'
      '401':
        description: |
          `Authentification requise.` — jeton absent, invalide, expiré ou révoqué.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
/auth/session:
  delete:
    operationId: signOut
    summary: Déconnexion de cet appareil
    responses:
      '204':
        description: La session est supprimée. Les autres appareils restent connectés.
      '401':
        description: |
          `Authentification requise.` — jeton absent, invalide, expiré ou révoqué.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
```

- [ ] **Étape 2 : régénérer les types du contrat**

Run : `pnpm --dir server generate:types`
Attendu : `server/src/domain/api.generated.ts` contient désormais `User`.

Run : `grep -n "User" server/src/domain/api.generated.ts | head -3`

- [ ] **Étape 3 : exposer `User` dans la façade du domaine**

Dans `server/src/domain/types.ts`, ajouter `User` à la ligne de réexport :

```typescript
export type {
  Idea,
  Variation,
  Status,
  User,
} from '#domain/api.generated';
```

- [ ] **Étape 4 : aligner `docs/api-design.md`**

Ajouter les trois messages à la table exhaustive :

| Code  | Message                                    | Quand                                                                               |
| ----- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `401` | `Authentification requise.`                | jeton absent, invalide, expiré ou révoqué — un seul message, pour ne rien divulguer |
| `400` | `Code d'autorisation invalide.`            | Google refuse l'échange du code                                                     |
| `502` | `Service d'authentification indisponible.` | Google injoignable                                                                  |

Et remplacer la section « Aucune authentification », qui devient fausse, par la
description du schéma `bearer` et la règle **`404` et jamais `403`** sur une idée
appartenant à autrui.

- [ ] **Étape 5 : écrire le middleware**

Fichier `server/src/middleware/auth.ts` :

```typescript
import type { Request, RequestHandler } from 'express';

import { ApiError } from '#config/api-error';
import { resolveSession } from '#store/sessions';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const UNAUTHENTICATED = () =>
  new ApiError(401, 'Authentification requise.');

const bearer = (header: string | undefined): string | null => {
  if (header === undefined) return null;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
};

export const requireSession: RequestHandler = async (
  req,
  _res,
  next,
) => {
  const token = bearer(req.headers.authorization);
  if (token === null) throw UNAUTHENTICATED();

  const userId = await resolveSession(token);
  if (userId === null) throw UNAUTHENTICATED();

  req.userId = userId;
  next();
};

// The type says optional because Express cannot know the middleware ran. A route
// mounted without it therefore fails closed, with a 401, instead of handing the
// store an undefined owner.
export function userIdOf(req: Request): string {
  const { userId } = req;
  if (userId === undefined) throw UNAUTHENTICATED();
  return userId;
}
```

- [ ] **Étape 6 : écrire le service, le contrôleur et le routeur**

Fichier `server/src/services/auth.ts` :

```typescript
import { ApiError } from '#config/api-error';
import type { User } from '#domain/types';
import { revokeSession } from '#store/sessions';
import { findUser } from '#store/users';

export async function currentUser(userId: string): Promise<User> {
  const user = await findUser(userId);
  // The session resolved a moment ago, so the account is gone mid-request.
  if (!user) throw new ApiError(401, 'Authentification requise.');
  return user;
}

export async function signOut(token: string): Promise<void> {
  await revokeSession(token);
}
```

Ajouter `findUser` à `server/src/store/users.ts` :

```typescript
export async function findUser(
  id: string,
): Promise<StoredUser | null> {
  const row = await db()
    .selectFrom('users')
    .select(['id', 'email'])
    .where('id', '=', id)
    .executeTakeFirst();

  return row ?? null;
}
```

Fichier `server/src/controllers/auth.ts` :

```typescript
import type { RequestHandler } from 'express';

import { userIdOf } from '#middleware/auth';
import * as authService from '#services/auth';

export const me: RequestHandler = async (req, res) => {
  res.status(200).json(await authService.currentUser(userIdOf(req)));
};

export const signOut: RequestHandler = async (req, res) => {
  // requireSession already proved the header is a usable bearer token.
  await authService.signOut(
    req.headers.authorization!.split(' ')[1]!,
  );
  res.status(204).end();
};
```

Fichier `server/src/routes/auth.ts` :

```typescript
import { Router } from 'express';

import * as authController from '#controllers/auth';
import { requireSession } from '#middleware/auth';

export const authRouter = Router();

authRouter.get('/me', requireSession, authController.me);

authRouter.delete('/session', requireSession, authController.signOut);
```

- [ ] **Étape 7 : monter le routeur**

Dans `server/src/app.ts`, ajouter l'import et la ligne de montage avant
`/ideas` :

```typescript
import { authRouter } from '#routes/auth';
```

```typescript
app.use('/auth', authRouter);
```

- [ ] **Étape 8 : écrire la fabrique de test**

Fichier `server/test/factories.ts` :

```typescript
import { createSession } from '#store/sessions';
import { upsertUser } from '#store/users';

export async function createUserWithSession(
  email = 'moi@example.test',
): Promise<{ userId: string; token: string }> {
  const user = await upsertUser(`sub-${crypto.randomUUID()}`, email);
  const token = await createSession(user.id, 'vitest');

  return { userId: user.id, token };
}

// Every call to createUserWithSession makes a new account, so a second device
// of the SAME account has to be asked for explicitly.
export async function addDevice(userId: string): Promise<string> {
  return createSession(userId, 'vitest');
}
```

- [ ] **Étape 9 : généraliser le test de dérive**

Supprimer `server/src/routes/ideas.test.ts` et créer
`server/src/routes/contract.test.ts` avec le **même contenu**, à trois
différences près.

Remplacer les imports et la constante `MOUNT` par :

```typescript
import { SPEC_PATH } from '#config/spec';
import { authRouter } from '#routes/auth';
import { ideasRouter } from '#routes/ideas';

// Where each router is mounted in app.ts — their own paths do not carry it.
const MOUNTED = [
  { router: ideasRouter, mount: '/ideas' },
  { router: authRouter, mount: '/auth' },
];
```

Remplacer le corps de `mountedOperations()` par :

```typescript
function mountedOperations(): string[] {
  return MOUNTED.flatMap(({ router, mount }) => {
    const { stack } = router as unknown as { stack: RouteLayer[] };

    return stack.flatMap(({ route }) => {
      if (!route) return [];

      const suffix = route.path === '/' ? '' : route.path;
      // Express spells parameters /:id, OpenAPI spells them /{id}.
      const path = `${mount}${suffix}`.replace(/:(\w+)/g, '{$1}');

      return Object.entries(route.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => `${method.toUpperCase()} ${path}`);
    });
  }).sort();
}
```

Et renommer le `describe` en `the mounted routes and docs/openapi.yaml`.

- [ ] **Étape 10 : écrire les tests HTTP de l'authentification**

Fichier `server/src/auth.test.ts` :

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { app } from '#app';
import { addDevice, createUserWithSession } from '../test/factories';

let server: Server;
let base: string;

beforeEach(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) =>
    server.once('listening', resolve),
  );
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(
  () => new Promise<void>((resolve) => server.close(() => resolve())),
);

const as = (token: string, path: string, init?: RequestInit) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });

const UNAUTHENTICATED = { error: 'Authentification requise.' };

describe('GET /auth/me', () => {
  it('answers with the account behind the session', async () => {
    const { userId, token } = await createUserWithSession(
      'moi@example.test',
    );

    const res = await as(token, '/auth/me');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: userId,
      email: 'moi@example.test',
    });
  });

  it('answers 401 without a token', async () => {
    const res = await fetch(`${base}/auth/me`);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(UNAUTHENTICATED);
  });

  it('answers 401 on a token that means nothing', async () => {
    const res = await as('not-a-token', '/auth/me');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(UNAUTHENTICATED);
  });

  it('answers 401 when the scheme is not Bearer', async () => {
    const { token } = await createUserWithSession();

    const res = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Basic ${token}` },
    });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /auth/session', () => {
  it('logs this device out and leaves the other one alone', async () => {
    // Two devices of the SAME account: createUserWithSession twice would make
    // two different accounts, and the assertion below would prove nothing.
    const { userId, token: laptop } = await createUserWithSession();
    const phone = await addDevice(userId);

    const out = await as(laptop, '/auth/session', {
      method: 'DELETE',
    });
    expect(out.status).toBe(204);

    expect((await as(laptop, '/auth/me')).status).toBe(401);
    expect((await as(phone, '/auth/me')).status).toBe(200);
  });
});
```

- [ ] **Étape 11 : lancer les tests de cette tâche**

Run : `pnpm test -- auth contract`
Attendu : `auth.test.ts` et `contract.test.ts` au vert. Les tests des idées
restent rouges depuis la tâche 1.

- [ ] **Étape 12 : prouver que le test de dérive mord**

Sabotage : commenter la ligne `authRouter.get('/me', …)` dans
`server/src/routes/auth.ts`, puis `pnpm test -- contract`.
Attendu : **ÉCHEC** — le spec déclare une opération que rien ne monte. Rétablir
et revérifier le vert.

- [ ] **Étape 13 : typecheck, lint, format**

Run : `pnpm typecheck && pnpm lint && pnpm exec prettier --check .`

- [ ] **Étape 14 : commit (PO)**

```
feat(server): resolve sessions and expose the current account

The contract drift test now covers every mounted router: it read the whole
paths section but only the ideas router, so the first /auth path would have
broken it. userIdOf() fails closed with a 401 rather than handing the store
an undefined owner.
```

---

## Tâche 4 : le cloisonnement

Le cœur. Tout ce qui est rouge depuis la tâche 1 redevient vert, et une idée
d'autrui devient introuvable.

**Fichiers :** créer `server/src/isolation.test.ts` ; modifier
`server/src/store/ideas.ts`, `server/src/services/ideas.ts`,
`server/src/controllers/ideas.ts`, `server/src/app.ts`,
`server/src/app.test.ts`, `server/src/services/ideas.test.ts`,
`server/src/store/ideas.test.ts`, `docs/openapi.yaml`

**Interfaces :**

- Consomme : `requireSession`, `userIdOf` (tâche 3), `createUserWithSession`.
- Produit : les six opérations du store, des services et des contrôleurs prenant
  `userId` en **premier paramètre**.

- [ ] **Étape 1 : déclarer le 401 sur les six opérations du contrat**

Dans `docs/openapi.yaml`, ajouter à **chacune** des six opérations, dans son bloc
`responses:` :

```yaml
'401':
  description: |
    `Authentification requise.` — jeton absent, invalide, expiré ou révoqué.
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/Error'
```

Puis : `pnpm --dir server generate:types`

- [ ] **Étape 2 : écrire le test de cloisonnement (il doit échouer)**

Fichier `server/src/isolation.test.ts` :

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { app } from '#app';
import type { Idea } from '#domain/types';
import { createUserWithSession } from '../test/factories';

let server: Server;
let base: string;

beforeEach(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) =>
    server.once('listening', resolve),
  );
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(
  () => new Promise<void>((resolve) => server.close(() => resolve())),
);

const as = (token: string, path: string, init?: RequestInit) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

const NOT_FOUND = { error: 'Idée introuvable.' };

describe('two accounts', () => {
  it('never see each other ideas', async () => {
    const alice = await createUserWithSession('alice@example.test');
    const bob = await createUserWithSession('bob@example.test');

    await as(alice.token, '/ideas', {
      method: 'POST',
      body: JSON.stringify({ text: 'idée de alice' }),
    });

    expect(await (await as(bob.token, '/ideas')).json()).toEqual([]);
    expect(
      ((await (await as(alice.token, '/ideas')).json()) as Idea[])
        .length,
    ).toBe(1);
  });

  it('get 404 and never 403 on each other ideas', async () => {
    const alice = await createUserWithSession('alice@example.test');
    const bob = await createUserWithSession('bob@example.test');

    const created = (await (
      await as(alice.token, '/ideas', {
        method: 'POST',
        body: JSON.stringify({ text: 'idée de alice' }),
      })
    ).json()) as Idea;
    const variationId = created.variations[0]!.id;

    // A 403 would confirm the idea exists and make identifiers enumerable.
    for (const [method, path, body] of [
      ['DELETE', `/ideas/${created.id}`, undefined],
      [
        'PATCH',
        `/ideas/${created.id}`,
        JSON.stringify({ status: 'ready' }),
      ],
      [
        'POST',
        `/ideas/${created.id}/variations`,
        JSON.stringify({ text: 'x' }),
      ],
      [
        'PATCH',
        `/ideas/${created.id}/variations/${variationId}`,
        JSON.stringify({ text: 'x' }),
      ],
    ] as const) {
      const res = await as(bob.token, path, { method, body });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual(NOT_FOUND);
    }

    // And none of it touched the idea.
    const still = (await (
      await as(alice.token, '/ideas')
    ).json()) as Idea[];
    expect(still[0]?.variations[0]?.text).toBe('idée de alice');
  });

  it('keep their ideas when the other account is deleted', async () => {
    const alice = await createUserWithSession('alice@example.test');
    const bob = await createUserWithSession('bob@example.test');

    await as(bob.token, '/ideas', {
      method: 'POST',
      body: JSON.stringify({ text: 'idée de bob' }),
    });
    await as(alice.token, '/ideas', {
      method: 'POST',
      body: JSON.stringify({ text: 'idée de alice' }),
    });

    const { db } = await import('#store/db');
    await db()
      .deleteFrom('users')
      .where('id', '=', alice.userId)
      .execute();

    const left = (await (
      await as(bob.token, '/ideas')
    ).json()) as Idea[];
    expect(left).toHaveLength(1);
    expect(left[0]?.variations[0]?.text).toBe('idée de bob');
  });
});
```

- [ ] **Étape 3 : lancer, vérifier l'échec**

Run : `pnpm test -- isolation`
Attendu : **ÉCHEC** — aucun endpoint n'exige de session et rien ne filtre.

- [ ] **Étape 4 : protéger les routes des idées**

Dans `server/src/app.ts`, remplacer la ligne de montage de `/ideas` par :

```typescript
app.use('/ideas', requireSession, ideasRouter);
```

…et ajouter l'import `import { requireSession } from '#middleware/auth';`

- [ ] **Étape 5 : ajouter `userId` au store**

Dans `server/src/store/ideas.ts`, pour **chacune** des six fonctions exportées :
ajouter `userId: string` en **premier** paramètre, et le filtre correspondant.

| Fonction        | Signature                                                         | Ce qui change dans la requête                                            |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `listIdeas`     | `(userId: string)`                                                | `.where('user_id', '=', userId)` sur le `selectFrom('ideas')`            |
| `createIdea`    | `(userId: string, text: string)`                                  | `.values({ user_id: userId })` au lieu de `.defaultValues()`             |
| `deleteIdea`    | `(userId: string, id: string)`                                    | `.where('user_id', '=', userId)` en plus du `where` sur l'id             |
| `changeStatus`  | `(userId: string, id: string, status: Status)`                    | idem sur l'`updateTable('ideas')`                                        |
| `addVariation`  | `(userId: string, id: string, text: string)`                      | idem sur le `selectFrom('ideas')` de contrôle **et** sur l'`updateTable` |
| `editVariation` | `(userId: string, id: string, variationId: string, text: string)` | idem sur le `selectFrom('ideas')` de contrôle **et** sur l'`updateTable` |

`readVariations` reste inchangée : elle n'est appelée qu'après un contrôle qui a
déjà prouvé que l'idée appartient à l'appelant.

- [ ] **Étape 6 : répercuter dans les services**

Dans `server/src/services/ideas.ts`, ajouter `userId: string` en premier
paramètre des six fonctions exportées et le passer tel quel au store. Aucune
autre logique ne change : la validation et les messages restent identiques.

- [ ] **Étape 7 : répercuter dans les contrôleurs**

Dans `server/src/controllers/ideas.ts`, ajouter
`import { userIdOf } from '#middleware/auth';` et passer `userIdOf(req)` en
premier argument de chaque appel au service. Exemple pour `list` :

```typescript
export const list: RequestHandler = async (req, res) => {
  res.status(200).json(await ideaService.listIdeas(userIdOf(req)));
};
```

- [ ] **Étape 8 : authentifier les tests existants**

Dans `server/src/app.test.ts`, remplacer les helpers par :

```typescript
import { createUserWithSession } from '../test/factories';

let token: string;

beforeEach(async () => {
  ({ token } = await createUserWithSession());
});

const api = (path: string, init?: RequestInit) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });
```

`send` et `createIdea` s'appuient déjà sur `api`, ils n'ont pas à changer. Le
`beforeEach` qui crée la session doit être déclaré **après** celui qui démarre le
serveur.

Dans `server/src/services/ideas.test.ts` et `server/src/store/ideas.test.ts` :
créer un utilisateur en tête de chaque test et passer son `userId` en premier
argument.

```typescript
import { createUserWithSession } from '../../test/factories';

let userId: string;

beforeEach(async () => {
  ({ userId } = await createUserWithSession());
});
```

- [ ] **Étape 9 : lancer toute la suite**

Run : `pnpm test`
Attendu : **tout au vert**. Le nombre de tests a augmenté de la tâche 2 (8) et de
cette tâche (3), plus les 4 de la tâche 3.

- [ ] **Étape 10 : prouver le cloisonnement par sabotage**

Retirer `.where('user_id', '=', userId)` de `listIdeas` dans
`server/src/store/ideas.ts`, puis `pnpm test -- isolation`.
Attendu : **ÉCHEC** sur `never see each other ideas`. Rétablir, revérifier.

Recommencer avec `deleteIdea` : retirer son filtre, relancer.
Attendu : **ÉCHEC** sur `get 404 and never 403`. Rétablir.

Un test de cloisonnement qu'on n'a pas vu échouer ne prouve rien.

- [ ] **Étape 11 : vérifier la stabilité**

Run : `pnpm test && pnpm test && pnpm test`
Attendu : trois passages verts d'affilée.

- [ ] **Étape 12 : typecheck, lint, format**

Run : `pnpm typecheck && pnpm lint && pnpm exec prettier --check .`

- [ ] **Étape 13 : commit (PO)**

```
feat(server): scope every idea to its owner

userId travels explicitly through all three layers: an implicit context would
compile, pass the happy-path tests and leak in production, whereas forgetting
an explicit parameter does not build. Another account's idea answers 404, not
403, so identifiers stay unenumerable.
```

---

## Tâche 5 : la connexion Google

**Fichiers :** créer `server/src/config/google.ts`,
`server/src/google-auth.test.ts` ; modifier `server/src/services/auth.ts`,
`server/src/controllers/auth.ts`, `server/src/routes/auth.ts`,
`server/src/config/env.ts`, `docs/openapi.yaml`, `docs/api-design.md`

**Interfaces :**

- Consomme : `upsertUser`, `createSession`.
- Produit : `POST /auth/google`, et `exchangeCode(code, codeVerifier): Promise<GoogleIdentity>`.

- [ ] **Étape 1 : déclarer l'endpoint dans le contrat**

Ajouter à `paths:` dans `docs/openapi.yaml` :

```yaml
/auth/google:
  post:
    operationId: signInWithGoogle
    summary: Échange un code d'autorisation Google contre une session
    security: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            additionalProperties: false
            required: [code, codeVerifier]
            properties:
              code:
                type: string
                minLength: 1
              codeVerifier:
                type: string
                minLength: 1
    responses:
      '201':
        description: La session est ouverte.
        content:
          application/json:
            schema:
              type: object
              additionalProperties: false
              required: [token, user]
              properties:
                token:
                  type: string
                user:
                  $ref: '#/components/schemas/User'
      '400':
        description: |
          `Code d'autorisation invalide.` — corps invalide, ou code refusé par Google.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
      '502':
        description: |
          `Service d'authentification indisponible.` — Google est injoignable.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
```

Le `security: []` **au niveau de l'opération** est indispensable : c'est le seul
endpoint qui doit rester accessible sans session.

Puis : `pnpm --dir server generate:types`

- [ ] **Étape 2 : compléter la configuration**

Dans `server/src/config/env.ts`, ajouter :

```typescript
export function googleConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI are required',
    );
  }

  return { clientId, clientSecret, redirectUri };
}
```

- [ ] **Étape 3 : écrire le seul module qui parle à Google**

Fichier `server/src/config/google.ts` :

```typescript
import { ApiError } from '#config/api-error';
import { googleConfig } from '#config/env';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export interface GoogleIdentity {
  sub: string;
  email: string;
}

// Google's own documentation: an ID token fetched by the server itself over
// HTTPS, authenticated by the client secret, does not need its signature
// verified. Validation is only required when the token travelled through
// another component.
const readIdentity = (idToken: string): GoogleIdentity => {
  const payload = idToken.split('.')[1];
  if (payload === undefined) {
    throw new ApiError(400, "Code d'autorisation invalide.");
  }

  const claims = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { sub?: string; email?: string };

  if (!claims.sub || !claims.email) {
    throw new ApiError(400, "Code d'autorisation invalide.");
  }

  return { sub: claims.sub, email: claims.email };
};

export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<GoogleIdentity> {
  const { clientId, clientSecret, redirectUri } = googleConfig();

  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
  } catch {
    // Network failure: ours or Google's, but not the client's fault.
    throw new ApiError(
      502,
      "Service d'authentification indisponible.",
    );
  }

  if (response.status >= 500) {
    throw new ApiError(
      502,
      "Service d'authentification indisponible.",
    );
  }

  if (!response.ok) {
    throw new ApiError(400, "Code d'autorisation invalide.");
  }

  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) {
    throw new ApiError(400, "Code d'autorisation invalide.");
  }

  return readIdentity(body.id_token);
}
```

- [ ] **Étape 4 : écrire le service**

Ajouter à `server/src/services/auth.ts` :

```typescript
import { z } from 'zod';

import { exchangeCode } from '#config/google';
import { createSession } from '#store/sessions';
import { upsertUser } from '#store/users';

const GoogleBody = z.strictObject({
  code: z.string().trim().min(1),
  codeVerifier: z.string().trim().min(1),
});

export async function signInWithGoogle(
  body: unknown,
  userAgent: string | null,
): Promise<{ token: string; user: User }> {
  const parsed = GoogleBody.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "Code d'autorisation invalide.");
  }

  const identity = await exchangeCode(
    parsed.data.code,
    parsed.data.codeVerifier,
  );
  const user = await upsertUser(identity.sub, identity.email);
  const token = await createSession(user.id, userAgent);

  return { token, user };
}
```

- [ ] **Étape 5 : contrôleur et route**

Ajouter à `server/src/controllers/auth.ts` :

```typescript
export const signInWithGoogle: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(
      await authService.signInWithGoogle(
        req.body,
        req.headers['user-agent'] ?? null,
      ),
    );
};
```

Ajouter à `server/src/routes/auth.ts`, **sans** `requireSession` :

```typescript
authRouter.post('/google', authController.signInWithGoogle);
```

- [ ] **Étape 6 : écrire les tests, Google simulé**

Fichier `server/src/google-auth.test.ts` :

```typescript
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { ApiError } from '#config/api-error';
import { app } from '#app';

vi.mock('#config/google', () => ({
  exchangeCode: vi.fn(),
}));

const { exchangeCode } = await import('#config/google');
const mocked = vi.mocked(exchangeCode);

let server: Server;
let base: string;

beforeEach(async () => {
  mocked.mockReset();
  server = app.listen(0);
  await new Promise<void>((resolve) =>
    server.once('listening', resolve),
  );
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(
  () => new Promise<void>((resolve) => server.close(() => resolve())),
);

const signIn = (body: unknown) =>
  fetch(`${base}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const VALID = { code: 'abc', codeVerifier: 'xyz' };

describe('POST /auth/google', () => {
  it('opens a session for a new account', async () => {
    mocked.mockResolvedValue({
      sub: 'sub-1',
      email: 'moi@example.test',
    });

    const res = await signIn(VALID);

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      token: string;
      user: { email: string };
    };
    expect(body.user.email).toBe('moi@example.test');

    const me = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${body.token}` },
    });
    expect(me.status).toBe(200);
  });

  it('reuses the account on a second sign-in, and adds a session', async () => {
    mocked.mockResolvedValue({
      sub: 'sub-1',
      email: 'moi@example.test',
    });

    const first = (await (await signIn(VALID)).json()) as {
      token: string;
      user: { id: string };
    };
    const second = (await (await signIn(VALID)).json()) as {
      token: string;
      user: { id: string };
    };

    expect(second.user.id).toBe(first.user.id);
    expect(second.token).not.toBe(first.token);
    // Signing in on a second device must not close the first one.
    for (const token of [first.token, second.token]) {
      const me = await fetch(`${base}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(me.status).toBe(200);
    }
  });

  it('follows Google when it rejects the code', async () => {
    mocked.mockRejectedValue(
      new ApiError(400, "Code d'autorisation invalide."),
    );

    const res = await signIn(VALID);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Code d'autorisation invalide.",
    });
  });

  it('answers 502 when Google cannot be reached', async () => {
    mocked.mockRejectedValue(
      new ApiError(502, "Service d'authentification indisponible."),
    );

    const res = await signIn(VALID);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Service d'authentification indisponible.",
    });
  });

  it('rejects a body that is not the contract', async () => {
    for (const body of [
      {},
      { code: 'abc' },
      { ...VALID, extra: 1 },
    ]) {
      const res = await signIn(body);

      expect(res.status).toBe(400);
    }
    expect(mocked).not.toHaveBeenCalled();
  });

  it('needs no session of its own', async () => {
    mocked.mockResolvedValue({
      sub: 'sub-1',
      email: 'moi@example.test',
    });

    // No Authorization header anywhere above: this is the one endpoint that
    // must work without one.
    expect((await signIn(VALID)).status).toBe(201);
  });
});
```

- [ ] **Étape 7 : lancer**

Run : `pnpm test`
Attendu : tout au vert, y compris `contract.test.ts` — qui exige que
`/auth/google` soit à la fois déclaré et monté.

- [ ] **Étape 8 : typecheck, lint, format**

Run : `pnpm typecheck && pnpm lint && pnpm exec prettier --check .`

- [ ] **Étape 9 : commit (PO)**

```
feat(server): sign in with a google account

The code exchange happens server-side because a Web application client must
send its client_secret, which therefore never reaches the extension. The ID
token needs no signature check: the server fetched it from Google itself.
```

---

## Tâche 6 : documentation et vérification réelle

- [ ] **Étape 1 : le README**

Ajouter à `README.md`, dans la section de lancement de l'API, les trois
variables `GOOGLE_*` et la mention qu'elles sont nécessaires **uniquement** pour
une connexion réelle — la suite de tests n'en a pas besoin.

- [ ] **Étape 2 : `structure.md`**

Déclarer `server/src/routes/auth.ts`, `controllers/auth.ts`, `services/auth.ts`,
`middleware/auth.ts`, `config/google.ts`, `store/users.ts`, `store/sessions.ts`,
`test/factories.ts` et `migrations/002_auth.sql`.

- [ ] **Étape 3 : `storage.md`**

Ajouter aux invariants : une idée appartient à un compte, le cloisonnement est
appliqué dans le store, et une idée d'autrui répond `404` et jamais `403`.

- [ ] **Étape 4 : `CLAUDE.md`**

Retirer la mention _(conçue, pas encore construite)_ de la ligne
**Authentification**, et le paragraphe « Ce qui est décidé n'est pas ce qui est
construit » — il ne vaut plus que pour l'hébergement, à reformuler en ce sens.

- [ ] **Étape 5 : vérification réelle (PO + exécutant)**

Exige les valeurs `GOOGLE_*` de la tâche 0. Le flux complet n'étant pas
déclenchable sans l'extension, on vérifie l'endpoint seul avec un code obtenu à
la main depuis un navigateur, puis :

```bash
curl -s -X POST localhost:3000/auth/google \
  -H 'Content-Type: application/json' \
  -d '{"code":"<le code>","codeVerifier":"<le verifier>"}'
```

Attendu : `201` avec un `token` et l'e-mail du compte Google.

Puis, avec ce jeton :

```bash
curl -s localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"
curl -s localhost:3000/ideas   -H "Authorization: Bearer $TOKEN"
curl -si localhost:3000/ideas                       # 401 attendu
```

Si cette étape échoue, c'est la configuration Google qui est en cause, pas le
code : les tests couvrent tout ce qui est à nous.

- [ ] **Étape 6 : commit (PO)**

```
docs: describe accounts and per-user isolation
```

---

## Ce que ce plan ne fait pas

- **L'extension** : `launchWebAuthFlow`, stockage du jeton, _retry_.
- **L'hébergement OVH** : domaine, HTTPS, secrets, sauvegardes.
- **E-mail + mot de passe** : brique ultérieure, sur la même table `sessions`.
- **La liste « mes appareils »** et la déconnexion à distance.
- **Le script de reprise** des idées du stockage local.
- **RLS** : le filtrage explicite et le sabotage couvrent le risque principal.
