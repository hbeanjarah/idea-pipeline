# Persistance PostgreSQL — plan d'implémentation

> **Pour l'exécutant :** les étapes sont des cases à cocher (`- [ ]`). Une étape
> = une action. On ne passe pas à la suivante sans avoir lancé la commande de
> vérification de la précédente.

**But :** remplacer la `Map` en mémoire du serveur par PostgreSQL, sans qu'une
seule ligne de `services/`, `controllers/` ou `routes/` change.

**Architecture :** le SQL détient la vérité (migrations `.sql` versionnées) ;
`kysely-codegen` introspecte la base et en dérive les types TypeScript ; le
store traduit les lignes en objets du domaine. Les six fonctions du store
gardent leur signature exacte — c'est la frontière posée à la brique
d'architecture qui est mise à l'épreuve ici.

**Pile :** PostgreSQL 17 (Docker Compose) · Kysely · `pg` · kysely-codegen ·
Testcontainers · Vitest 4.

**Spec :** `docs/persistence-design.md` (validée par le PO). Le plan argumente
depuis la spec : les deux se lisent ensemble.

## Contraintes globales

Elles s'appliquent à **toutes** les tâches, sans être répétées.

- **Git : 100 % manuel.** Claude Code n'exécute aucune commande Git. Les étapes
  « Commit » donnent le **texte** du message ; c'est le PO qui commite.
- **Installation des dépendances : 100 % manuelle.** Claude Code ne lance ni
  `pnpm add`, ni `pnpm remove`, ni `pnpm update`. Cf. `.claude/rules/dependencies.md`.
- **Code en anglais**, commentaires compris. Le français est réservé aux textes
  vus par l'utilisateur — donc aux messages d'erreur de l'API, repris mot pour
  mot de `docs/api-design.md`.
- **Commentaires** : jamais de bloc de documentation, jamais de paraphrase. On
  ne commente que ce que le code ne peut pas dire. Cf. `.claude/rules/code-style.md`.
- **Imports sans extension**, via les alias `#*` (`#store/db`, `#config/env`…).
- **Le livré passe `pnpm lint`, `pnpm typecheck` et `pnpm test`** sans erreur.
- Terrain : Node 24.11.0 · pnpm 10.28.2 · TypeScript ~6.0.3 · serveur en ESM.

## Trois écarts par rapport à la spec, à valider

Repérés en relisant le code réel. Ils ne remettent pas la conception en cause,
mais deux d'entre eux changent la commande d'installation.

1. **`@testcontainers/postgresql` au lieu de `testcontainers`.** Le module
   Postgres (`PostgreSqlContainer`, `getConnectionUri()`) vit dans un paquet
   séparé, qui tire `testcontainers` en dépendance. La commande de la spec
   installait le cœur sans le module.
2. **Le runner de migrations n'utilise pas l'API `Migrator` de Kysely.** Kysely
   passe toujours un tableau de paramètres à `pg`, ce qui force le protocole
   étendu — lequel **refuse plusieurs instructions dans une même requête**. Un
   fichier `.sql` de DDL en contient forcément plusieurs. On écrit donc un
   runner minimal (~35 lignes) sur le pool `pg`, qui n'ajoute aucune
   dépendance — c'était l'intention de la spec.
3. **L'image `postgres:17` n'est pas en cache local** (seul `postgres:16-alpine`
   l'est). Le premier lancement des tests la télécharge.

## Structure des fichiers

| Fichier                                        | Rôle                                                     |
| ---------------------------------------------- | -------------------------------------------------------- |
| `docker-compose.yml`                           | **créer** — la base de développement                     |
| `server/.env.example`                          | **modifier** — ajoute `DATABASE_URL`                     |
| `server/src/config/env.ts`                     | **modifier** — expose `databaseUrl()`                    |
| `server/migrations/001_initial.sql`            | **créer** — LA source du schéma                          |
| `server/src/store/migrations.ts`               | **créer** — runner, réutilisé par les tests              |
| `server/src/store/migrate-cli.ts`              | **créer** — point d'entrée `db:migrate`                  |
| `server/src/store/db.ts`                       | **créer** — instance Kysely paresseuse                   |
| `server/src/store/schema.generated.ts`         | **généré, commité**                                      |
| `server/src/store/ideas.ts`                    | **réécrire** — signatures inchangées                     |
| `server/src/store/ideas.test.ts`               | **réécrire**                                             |
| `server/src/store/status-constraint.test.ts`   | **créer** — garde-fou `CHECK` ↔ `STATUSES`               |
| `server/test/global-setup.ts`                  | **créer** — conteneur + migrations, une fois             |
| `server/test/setup.ts`                         | **créer** — `TRUNCATE` avant chaque test                 |
| `vitest.config.ts`                             | **modifier** — branche le harnais sur le projet `server` |
| `server/tsconfig.json` / `tsconfig.build.json` | **modifier** — prend `test/` en compte                   |
| `server/package.json`                          | **modifier** — scripts `db:migrate`, `db:types`          |
| `.prettierignore` / `eslint.config.js`         | **modifier** — ignorent le fichier généré                |
| `CLAUDE.md` · `storage.md` · `structure.md`    | **modifier** — le discours change                        |

---

## Tâche 0 : installation des dépendances (PO)

Aucune autre tâche ne démarre avant celle-ci.

- [ ] **Étape 1 : installer le runtime**

```bash
pnpm --dir server add kysely pg
```

`kysely` est le query builder typé ; `pg` le driver PostgreSQL. Les deux sont
nécessaires à l'exécution du serveur → section `dependencies`.

- [ ] **Étape 2 : installer l'outillage de développement**

```bash
pnpm --dir server add -D @types/pg kysely-codegen @testcontainers/postgresql
```

`@types/pg` : `pg` ne fournit pas ses types. `kysely-codegen` : génère les types
depuis la base. `@testcontainers/postgresql` : le conteneur éphémère des tests
(il tire `testcontainers` avec lui). Aucun des trois n'est utile en production →
section `devDependencies`.

- [ ] **Étape 3 : vérifier**

Run : `node -e "const p=require('./server/package.json');console.log(p.dependencies,p.devDependencies)"`
Attendu : `kysely` et `pg` dans `dependencies` ; `@types/pg`, `kysely-codegen`
et `@testcontainers/postgresql` dans `devDependencies`.

---

## Tâche 1 : socle local — Compose, schéma, runner de migrations

**Fichiers :**

- Créer : `docker-compose.yml`, `server/migrations/001_initial.sql`,
  `server/src/store/migrations.ts`, `server/src/store/migrate-cli.ts`
- Modifier : `server/.env.example`, `server/src/config/env.ts`,
  `server/package.json`

**Interfaces :**

- Consomme : rien (première tâche de code).
- Produit : `migrate(pool: Pool): Promise<string[]>` — renvoie les noms des
  fichiers appliqués lors de cet appel (tableau vide si tout l'était déjà) ;
  `databaseUrl(): string` depuis `#config/env`.

- [ ] **Étape 1 : écrire le Compose**

Fichier `docker-compose.yml`, à la racine :

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: idea
      POSTGRES_PASSWORD: idea
      POSTGRES_DB: idea_pipeline
    ports:
      - '5432:5432'
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U idea -d idea_pipeline']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  db-data:
```

Pas de clé `version:` — elle est obsolète depuis Compose v2 et provoque un
avertissement.

- [ ] **Étape 2 : démarrer la base et vérifier qu'elle répond**

Run : `docker compose up -d && docker compose ps`
Attendu : le service `db` en `running (healthy)`. Si l'état reste `starting`,
attendre 10 s et relancer `docker compose ps`.

- [ ] **Étape 3 : déclarer l'URL de connexion**

Dans `server/.env.example`, ajouter sous la ligne `PORT=3000` :

```
DATABASE_URL=postgres://idea:idea@localhost:5432/idea_pipeline
```

Puis créer le `.env` réel (il est gitignoré, donc absent d'un checkout neuf) :

Run : `cp server/.env.example server/.env`

- [ ] **Étape 4 : exposer l'URL depuis la config**

Dans `server/src/config/env.ts`, ajouter après la définition de `env` :

```typescript
// Read on each call rather than at import time: under vitest the test
// container only publishes its port once the global setup has run, long after
// this module was first imported.
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (raw === undefined || raw === '') {
    throw new Error('DATABASE_URL is required');
  }

  return raw;
}
```

- [ ] **Étape 5 : écrire la migration initiale**

Fichier `server/migrations/001_initial.sql` :

```sql
CREATE TABLE ideas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status      text        NOT NULL DEFAULT 'captured'
                          CONSTRAINT ideas_status_check
                          CHECK (status IN ('captured', 'maturing', 'ready', 'published')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE variations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id     uuid        NOT NULL REFERENCES ideas (id) ON DELETE CASCADE,
  position    integer     NOT NULL,
  text        text        NOT NULL CHECK (btrim(text) <> ''),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, position)
);

CREATE INDEX variations_idea_id_idx ON variations (idea_id);
CREATE INDEX ideas_updated_at_idx ON ideas (updated_at DESC, id DESC);
```

La contrainte de statut est **nommée explicitement** : le garde-fou de la
tâche 3 la retrouve par son nom dans `pg_constraint`. `gen_random_uuid()` est
natif depuis PostgreSQL 13, aucune extension à activer.

- [ ] **Étape 6 : écrire le runner de migrations**

Fichier `server/src/store/migrations.ts` :

```typescript
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pool } from 'pg';

// Same depth from src/store/ as from dist/store/, so this resolves to
// server/migrations in development and in a built server alike.
const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);

export async function migrate(pool: Pool): Promise<string[]> {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations',
    );
    const applied = new Set(rows.map((row) => row.name));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const ran: string[] = [];

    for (const file of files) {
      if (applied.has(file)) continue;

      const statements = await readFile(
        join(MIGRATIONS_DIR, file),
        'utf8',
      );

      await client.query('BEGIN');
      try {
        // Passing no parameters keeps pg on the simple protocol, the only one
        // that accepts several statements in a single call.
        await client.query(statements);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      ran.push(file);
    }

    return ran;
  } finally {
    client.release();
  }
}
```

- [ ] **Étape 7 : écrire le point d'entrée en ligne de commande**

Fichier `server/src/store/migrate-cli.ts` :

```typescript
import { Pool } from 'pg';

import { databaseUrl } from '#config/env';
import { migrate } from '#store/migrations';

const pool = new Pool({ connectionString: databaseUrl() });

try {
  const applied = await migrate(pool);
  console.log(
    applied.length === 0
      ? 'No migration to apply.'
      : `Applied: ${applied.join(', ')}`,
  );
} finally {
  await pool.end();
}
```

- [ ] **Étape 8 : déclarer les scripts**

Dans `server/package.json`, ajouter à `scripts` :

```json
"db:migrate": "tsx --env-file=.env --conditions=development src/store/migrate-cli.ts",
"db:types": "kysely-codegen --dialect postgres --out-file src/store/schema.generated.ts"
```

`kysely-codegen` lit `DATABASE_URL` depuis `server/.env` tout seul — inutile de
la passer en argument, ce qui évite une expansion de variable dépendante du shell.

- [ ] **Étape 9 : appliquer les migrations**

Run : `pnpm --dir server db:migrate`
Attendu : `Applied: 001_initial.sql`

- [ ] **Étape 10 : prouver l'idempotence**

Run : `pnpm --dir server db:migrate`
Attendu : `No migration to apply.` — un deuxième passage ne doit rien rejouer.

- [ ] **Étape 11 : vérifier le schéma réellement créé**

Run :

```bash
docker compose exec -T db psql -U idea -d idea_pipeline -c '\d ideas' -c '\d variations'
```

Attendu : les deux tables, l'index `ideas_updated_at_idx` sur
`(updated_at DESC, id DESC)`, la contrainte `ideas_status_check`, et la clé
étrangère `ON DELETE CASCADE` sur `variations.idea_id`.

- [ ] **Étape 12 : typecheck**

Run : `pnpm typecheck`
Attendu : aucune erreur.

- [ ] **Étape 13 : commit (PO)**

Fichiers : `docker-compose.yml`, `server/migrations/001_initial.sql`,
`server/src/store/migrations.ts`, `server/src/store/migrate-cli.ts`,
`server/src/config/env.ts`, `server/.env.example`, `server/package.json`

```
feat(server): add the postgres schema and its migration runner

Version the DDL as plain .sql files and apply them with a small runner on
the pg pool: kysely's migrator always sends a parameter array, which puts
pg on the extended protocol and rules out multi-statement files.
```

---

## Tâche 2 : connexion Kysely et types générés

**Fichiers :**

- Créer : `server/src/store/db.ts`
- Générer puis commiter : `server/src/store/schema.generated.ts`
- Modifier : `.prettierignore`, `eslint.config.js`

**Interfaces :**

- Consomme : `databaseUrl()` depuis `#config/env` (tâche 1) ; la base migrée.
- Produit : `db(): Kysely<DB>` et `closeDb(): Promise<void>` depuis `#store/db` ;
  le type `DB` depuis `#store/schema.generated`.

- [ ] **Étape 1 : générer les types depuis la base**

Run : `pnpm --dir server db:types`
Attendu : `server/src/store/schema.generated.ts` créé, contenant
`export interface DB` avec les clés `ideas`, `variations` et
`schema_migrations`.

- [ ] **Étape 2 : vérifier ce qui a été généré**

Run : `grep -n "interface DB" -A 6 server/src/store/schema.generated.ts`
Attendu : les trois tables. Si `schema_migrations` manque, la migration n'a pas
tourné — revenir à la tâche 1, étape 9.

- [ ] **Étape 3 : soustraire le fichier généré au formatage et au lint**

Dans `.prettierignore`, ajouter sous la ligne existante :

```
server/src/store/schema.generated.ts
```

Dans `eslint.config.js`, ligne 10, étendre la liste :

```javascript
{ ignores: ['**/dist', 'server/src/domain/api.generated.ts', 'server/src/store/schema.generated.ts'] },
```

Ce fichier-ci est **commité**, contrairement à `api.generated.ts` : il ne peut
être régénéré que contre une base vivante, donc un checkout sans Docker ne
pourrait pas le reconstruire et `typecheck` échouerait.

- [ ] **Étape 4 : écrire la connexion**

Fichier `server/src/store/db.ts` :

```typescript
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import { databaseUrl } from '#config/env';
import type { DB } from '#store/schema.generated';

let instance: Kysely<DB> | undefined;

// Built on first use, not at import time: the connection string is only known
// once the test container has started, and the pool would otherwise be created
// against an address that does not exist yet.
export function db(): Kysely<DB> {
  instance ??= new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl() }),
    }),
  });

  return instance;
}

export async function closeDb(): Promise<void> {
  await instance?.destroy();
  instance = undefined;
}
```

- [ ] **Étape 5 : prouver que la connexion parle à la base**

Run :

```bash
pnpm --dir server exec tsx --env-file=.env --conditions=development \
  -e "import {sql} from 'kysely'; import {db,closeDb} from '#store/db'; \
      const r = await sql\`select count(*)::int as n from ideas\`.execute(db()); \
      console.log(r.rows); await closeDb();"
```

Attendu : `[ { n: 0 } ]`

- [ ] **Étape 6 : typecheck et lint**

Run : `pnpm typecheck && pnpm lint`
Attendu : aucune erreur. Le fichier généré ne doit produire ni erreur ESLint ni
écart Prettier — s'il en produit, l'étape 3 a été mal appliquée.

- [ ] **Étape 7 : commit (PO)**

```
feat(server): connect kysely to postgres

Commit the generated schema types, unlike the OpenAPI ones: kysely-codegen
introspects a live database, so a fresh checkout without Docker could not
rebuild them and typecheck would fail.
```

---

## Tâche 3 : harnais de test conteneurisé

Le store est **encore la `Map`** à la fin de cette tâche. C'est voulu : le
harnais doit être prouvé avant qu'on s'appuie dessus. Le garde-fou des statuts
lui sert de premier client réel.

**Fichiers :**

- Créer : `server/test/global-setup.ts`, `server/test/setup.ts`,
  `server/src/store/status-constraint.test.ts`
- Modifier : `vitest.config.ts`, `server/tsconfig.json`,
  `server/tsconfig.build.json`

**Interfaces :**

- Consomme : `migrate(pool)` (tâche 1), `db()` / `closeDb()` (tâche 2),
  `STATUSES` depuis `#domain/types`.
- Produit : une base migrée et **vidée avant chaque test**, dont l'URL est
  publiée dans `process.env.DATABASE_URL`.

- [ ] **Étape 1 : faire entrer `test/` dans le périmètre TypeScript**

Dans `server/tsconfig.json`, remplacer la ligne `include` :

```json
"include": ["src/**/*.ts", "test/**/*.ts"]
```

Dans `server/tsconfig.build.json`, remplacer la ligne `exclude` :

```json
"exclude": ["**/*.test.ts", "test/**"]
```

Sans ce second changement, le harnais — qui importe une dépendance de
développement — serait compilé dans `dist/`.

- [ ] **Étape 2 : écrire le démarrage global du conteneur**

Fichier `server/test/global-setup.ts` :

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import type { TestProject } from 'vitest/node';

import { migrate } from '#store/migrations';

declare module 'vitest' {
  interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer;

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgres:17').start();

  const pool = new Pool({
    connectionString: container.getConnectionUri(),
  });
  try {
    await migrate(pool);
  } finally {
    await pool.end();
  }

  project.provide('databaseUrl', container.getConnectionUri());
}

export async function teardown(): Promise<void> {
  await container.stop();
}
```

- [ ] **Étape 3 : écrire l'isolation entre tests**

Fichier `server/test/setup.ts` :

```typescript
import { sql } from 'kysely';
import { afterAll, beforeEach, inject } from 'vitest';

import { closeDb, db } from '#store/db';

process.env.DATABASE_URL = inject('databaseUrl');

// vi.resetModules() used to give each test a fresh store; a fresh module does
// not empty a database. Emptying it belongs here, where no test file can
// forget it.
beforeEach(async () => {
  await sql`TRUNCATE ideas, variations CASCADE`.execute(db());
});

afterAll(async () => {
  await closeDb();
});
```

- [ ] **Étape 4 : brancher le harnais sur le projet vitest `server`**

Dans `vitest.config.ts`, dans le second projet, ajouter deux clés à `test`,
après `environment: 'node'` :

```typescript
          globalSetup: ['./test/global-setup.ts'],
          setupFiles: ['./test/setup.ts'],
```

- [ ] **Étape 5 : écrire le garde-fou des statuts (test d'abord)**

Fichier `server/src/store/status-constraint.test.ts` :

```typescript
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { STATUSES } from '#domain/types';
import { db } from '#store/db';

describe('the status check constraint', () => {
  // STATUSES comes from docs/openapi.yaml, the constraint from the migration.
  // Neither can be derived from the other, so the duplication is real; this
  // test is what keeps it from drifting in silence.
  it('lists exactly the statuses of the contract', async () => {
    const result = await sql<{ definition: string }>`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'ideas_status_check'
    `.execute(db());

    const definition = result.rows[0]?.definition;
    expect(definition).toBeDefined();

    const declared = [...definition!.matchAll(/'([a-z]+)'/g)].map(
      (match) => match[1],
    );

    expect(declared).toHaveLength(STATUSES.length);
    expect(new Set(declared)).toEqual(new Set(STATUSES));
  });
});
```

- [ ] **Étape 6 : lancer la suite**

Run : `pnpm test`
Attendu : **88 tests** au vert (les 87 actuels + le garde-fou). Le premier
lancement télécharge `postgres:17` — compter une à deux minutes de plus.

- [ ] **Étape 7 : prouver que le garde-fou n'est pas décoratif**

Sabotage temporaire : dans `server/migrations/001_initial.sql`, remplacer
`'published'` par `'archived'` dans la contrainte, puis :

```bash
docker compose down -v && docker compose up -d
pnpm test
```

Attendu : `status-constraint.test.ts` **échoue**. Rétablir `'published'`,
relancer `docker compose down -v && docker compose up -d && pnpm --dir server db:migrate`,
vérifier que `pnpm test` repasse au vert.

- [ ] **Étape 8 : typecheck et lint**

Run : `pnpm typecheck && pnpm lint`
Attendu : aucune erreur.

- [ ] **Étape 9 : commit (PO)**

```
test(server): run the suite against a real postgres container

One container for the whole suite, TRUNCATE between tests. Isolation moves
from vi.resetModules() to the database itself, and a guard test now fails
if the status CHECK and the OpenAPI enum ever drift apart.
```

---

## Tâche 4 : réécriture du store sur PostgreSQL

Le cœur. Écrit en TDD : les tests du store d'abord, qui échouent tant que la
`Map` est là.

**Fichiers :**

- Modifier : `server/src/store/ideas.ts` (réécriture complète),
  `server/src/store/ideas.test.ts` (réécriture complète),
  `server/src/services/ideas.test.ts` (retrait de `vi.resetModules`),
  `server/src/app.test.ts` (retrait de `vi.resetModules`)

**Interfaces :**

- Consomme : `db()` (tâche 2), le harnais (tâche 3).
- Produit : **les signatures actuelles, inchangées** —
  `listIdeas(): Promise<Idea[]>` · `createIdea(text: string): Promise<Idea>` ·
  `deleteIdea(id: string): Promise<boolean>` ·
  `changeStatus(id: string, status: Status): Promise<Idea | null>` ·
  `addVariation(id: string, text: string): Promise<Idea | null>` ·
  `editVariation(id: string, variationId: string, text: string): Promise<Idea | EditVariationFailure>` ·
  `export type EditVariationFailure = 'idea-not-found' | 'variation-not-found'`.

- [ ] **Étape 1 : supprimer les réinitialisations de modules**

Ces trois fichiers recréaient leur graphe de modules à chaque test. Avec une
base, cela recrée surtout **un pool de connexions par test**, jusqu'à épuiser
les connexions de PostgreSQL. L'isolation est désormais le `TRUNCATE`.

Dans `server/src/services/ideas.test.ts`, remplacer l'en-tête (lignes 1 à 12) par :

```typescript
import { beforeEach, describe, expect, it } from 'vitest';

import * as service from '#services/ideas';
```

…et supprimer le `beforeEach` qui appelait `vi.resetModules()`. Le commentaire
qui l'accompagnait décrivait ce mécanisme : il part avec lui.

Dans `server/src/app.test.ts`, remplacer le `beforeEach` par :

```typescript
import { app } from '#app';

beforeEach(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) =>
    server.once('listening', resolve),
  );
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
```

…et retirer `vi` des imports de `vitest` s'il n'y sert plus à rien.

- [ ] **Étape 2 : réécrire les tests du store**

Fichier `server/src/store/ideas.test.ts`, remplacer intégralement par :

```typescript
import { afterEach, describe, expect, it } from 'vitest';

import { db } from '#store/db';
import * as store from '#store/ideas';

// The database stamps updated_at with now(); fake timers cannot reach it.
// Rewriting the column is the only way to build a deterministic ordering.
const backdate = async (id: string, iso: string): Promise<void> => {
  await db()
    .updateTable('ideas')
    .set({ updated_at: new Date(iso) })
    .where('id', '=', id)
    .execute();
};

describe('listIdeas', () => {
  it('starts empty', async () => {
    expect(await store.listIdeas()).toEqual([]);
  });

  it('returns what was created', async () => {
    await store.createIdea('une idée');

    const ideas = await store.listIdeas();

    expect(ideas).toHaveLength(1);
    expect(ideas[0]?.variations[0]?.text).toBe('une idée');
  });
});

describe('createIdea', () => {
  it('enters the pipeline as captured, with one initial variation', async () => {
    const idea = await store.createIdea('une idée');

    expect(idea.status).toBe('captured');
    expect(idea.variations).toHaveLength(1);
    expect(idea.createdAt).toBe(idea.updatedAt);
  });

  it('renders timestamps as strict ISO 8601, not as driver Dates', async () => {
    const idea = await store.createIdea('une idée');

    expect(idea.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(idea.variations[0]?.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

describe('deleteIdea', () => {
  it('takes the variations down with the idea', async () => {
    const idea = await store.createIdea('une idée');

    expect(await store.deleteIdea(idea.id)).toBe(true);

    const left = await db()
      .selectFrom('variations')
      .select('id')
      .where('idea_id', '=', idea.id)
      .execute();
    expect(left).toEqual([]);
  });
});

describe('unknown identifiers', () => {
  // Postgres rejects a malformed uuid outright. Without a guard in the store
  // these would raise a 500 where the contract owes a 404.
  it('treats a non-uuid id as not found', async () => {
    expect(await store.deleteIdea('nope')).toBe(false);
    expect(await store.changeStatus('nope', 'ready')).toBeNull();
    expect(await store.addVariation('nope', 'suite')).toBeNull();
    expect(await store.editVariation('nope', 'nope', 'x')).toBe(
      'idea-not-found',
    );
  });
});

describe('addVariation', () => {
  it('appends after the initial variation', async () => {
    const created = await store.createIdea('première');

    const updated = await store.addVariation(created.id, 'seconde');

    expect(
      updated?.variations.map((variation) => variation.text),
    ).toEqual(['première', 'seconde']);
  });
});

describe('editVariation', () => {
  it('tells an unknown idea apart from an unknown variation', async () => {
    const idea = await store.createIdea('une idée');
    const variationId = idea.variations[0]!.id;
    const absent = '00000000-0000-4000-8000-000000000000';

    expect(await store.editVariation(absent, variationId, 'x')).toBe(
      'idea-not-found',
    );
    expect(await store.editVariation(idea.id, absent, 'x')).toBe(
      'variation-not-found',
    );
  });

  it('rewrites the text while freezing id and createdAt', async () => {
    const created = await store.createIdea('une idée');
    const before = created.variations[0]!;

    const edited = await store.editVariation(
      created.id,
      before.id,
      'corrigée',
    );

    expect(edited).not.toBe('idea-not-found');
    const after = (edited as typeof created).variations[0]!;
    expect(after.text).toBe('corrigée');
    expect(after.id).toBe(before.id);
    expect(after.createdAt).toBe(before.createdAt);
  });
});

describe('listIdeas ordering', () => {
  it('returns the most recently touched idea first', async () => {
    const first = await store.createIdea('la plus ancienne');
    const middle = await store.createIdea('celle du milieu');
    const last = await store.createIdea('la plus récente');

    await backdate(first.id, '2026-01-01T10:00:00.000Z');
    await backdate(middle.id, '2026-01-01T11:00:00.000Z');
    await backdate(last.id, '2026-01-01T12:00:00.000Z');

    expect((await store.listIdeas())[0]?.id).toBe(last.id);

    // Touching the oldest idea stamps it with now() and moves it to the front.
    await store.changeStatus(first.id, 'ready');

    expect((await store.listIdeas())[0]?.id).toBe(first.id);
  });

  it('orders ideas sharing a timestamp by descending id', async () => {
    const ideas = [
      await store.createIdea('a'),
      await store.createIdea('b'),
      await store.createIdea('c'),
    ];
    for (const idea of ideas) {
      await backdate(idea.id, '2026-01-01T10:00:00.000Z');
    }

    const listed = await store.listIdeas();
    const ids = listed.map((idea) => idea.id);

    // Without a genuine tie the assertion below would prove nothing.
    expect(new Set(listed.map((idea) => idea.updatedAt)).size).toBe(
      1,
    );
    expect(ids).toEqual([...ids].sort().reverse());
  });
});
```

Le test « hands back a copy, never the stored object » disparaît : il gardait un
piège propre à la `Map` — un objet partagé entre l'appelant et le stockage.
Chaque lecture repart maintenant d'une ligne relue, il ne pourrait plus échouer.

- [ ] **Étape 3 : lancer les tests et vérifier qu'ils échouent**

Run : `pnpm test`
Attendu : **ÉCHEC**. `ideas.test.ts` casse sur `db().updateTable(...)` appliqué
à une base vide alors que le store écrit toujours dans la `Map`, et les tests
d'identifiants non-uuid échouent faute de garde.

- [ ] **Étape 4 : réécrire le store**

Fichier `server/src/store/ideas.ts`, remplacer intégralement par :

```typescript
import { sql } from 'kysely';
import type { Selectable } from 'kysely';

import type { Idea, Status, Variation } from '#domain/types';
import { db } from '#store/db';
import type { DB } from '#store/schema.generated';

type IdeaRow = Selectable<DB['ideas']>;
type VariationRow = Selectable<DB['variations']>;

// Postgres raises on a malformed uuid instead of returning no row, so an
// unknown id would surface as a 500 where the contract owes a 404.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toVariation = (row: VariationRow): Variation => ({
  id: row.id,
  text: row.text,
  createdAt: row.created_at.toISOString(),
});

// status is `text` + CHECK, so the generated type is a plain string; the cast
// is kept honest by status-constraint.test.ts.
const toIdea = (row: IdeaRow, variations: VariationRow[]): Idea => ({
  id: row.id,
  status: row.status as Status,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  variations: variations.map(toVariation),
});

const touch = () => sql<Date>`now()`;

export async function listIdeas(): Promise<Idea[]> {
  const rows = await db()
    .selectFrom('ideas')
    .selectAll()
    .orderBy('updated_at', 'desc')
    .orderBy('id', 'desc')
    .execute();

  if (rows.length === 0) return [];

  // Two queries rather than one with jsonb_agg: aggregating turns timestamptz
  // into Postgres's own rendering, while the driver hands back a Date the
  // contract's strict ISO 8601 can be built from.
  const variations = await db()
    .selectFrom('variations')
    .selectAll()
    .where(
      'idea_id',
      'in',
      rows.map((row) => row.id),
    )
    .orderBy('position')
    .execute();

  const grouped = new Map<string, VariationRow[]>();
  for (const variation of variations) {
    const bucket = grouped.get(variation.idea_id) ?? [];
    bucket.push(variation);
    grouped.set(variation.idea_id, bucket);
  }

  return rows.map((row) => toIdea(row, grouped.get(row.id) ?? []));
}

export async function createIdea(text: string): Promise<Idea> {
  return db()
    .transaction()
    .execute(async (trx) => {
      const idea = await trx
        .insertInto('ideas')
        .defaultValues()
        .returningAll()
        .executeTakeFirstOrThrow();

      const variation = await trx
        .insertInto('variations')
        .values({ idea_id: idea.id, position: 1, text })
        .returningAll()
        .executeTakeFirstOrThrow();

      return toIdea(idea, [variation]);
    });
}

export async function deleteIdea(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;

  const result = await db()
    .deleteFrom('ideas')
    .where('id', '=', id)
    .executeTakeFirst();

  return result.numDeletedRows > 0n;
}

export async function changeStatus(
  id: string,
  status: Status,
): Promise<Idea | null> {
  if (!UUID.test(id)) return null;

  const idea = await db()
    .updateTable('ideas')
    .set({ status, updated_at: touch() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!idea) return null;

  return toIdea(idea, await readVariations(id));
}

export async function addVariation(
  id: string,
  text: string,
): Promise<Idea | null> {
  if (!UUID.test(id)) return null;

  return db()
    .transaction()
    .execute(async (trx) => {
      const exists = await trx
        .selectFrom('ideas')
        .select('id')
        .where('id', '=', id)
        .executeTakeFirst();

      if (!exists) return null;

      await trx
        .insertInto('variations')
        .values({
          idea_id: id,
          text,
          // Computing the position in SQL keeps it inside the transaction; the
          // unique index on (idea_id, position) turns a concurrent insert into
          // an error rather than a silent reorder.
          position: sql<number>`(SELECT COALESCE(MAX(position), 0) + 1 FROM variations WHERE idea_id = ${id})`,
        })
        .execute();

      const idea = await trx
        .updateTable('ideas')
        .set({ updated_at: touch() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

      const variations = await trx
        .selectFrom('variations')
        .selectAll()
        .where('idea_id', '=', id)
        .orderBy('position')
        .execute();

      return toIdea(idea, variations);
    });
}

// A plain null cannot say which of the two lookups failed, and the API owes a
// different message for each.
export type EditVariationFailure =
  | 'idea-not-found'
  | 'variation-not-found';

export async function editVariation(
  id: string,
  variationId: string,
  text: string,
): Promise<Idea | EditVariationFailure> {
  if (!UUID.test(id)) return 'idea-not-found';
  if (!UUID.test(variationId)) return 'variation-not-found';

  return db()
    .transaction()
    .execute(async (trx) => {
      const exists = await trx
        .selectFrom('ideas')
        .select('id')
        .where('id', '=', id)
        .executeTakeFirst();

      if (!exists) return 'idea-not-found';

      const edited = await trx
        .updateTable('variations')
        .set({ text })
        .where('id', '=', variationId)
        .where('idea_id', '=', id)
        .returning('id')
        .executeTakeFirst();

      if (!edited) return 'variation-not-found';

      const idea = await trx
        .updateTable('ideas')
        .set({ updated_at: touch() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

      const variations = await trx
        .selectFrom('variations')
        .selectAll()
        .where('idea_id', '=', id)
        .orderBy('position')
        .execute();

      return toIdea(idea, variations);
    });
}

async function readVariations(
  ideaId: string,
): Promise<VariationRow[]> {
  return db()
    .selectFrom('variations')
    .selectAll()
    .where('idea_id', '=', ideaId)
    .orderBy('position')
    .execute();
}
```

- [ ] **Étape 5 : relancer la suite**

Run : `pnpm test`
Attendu : **tout au vert**, 34 tests front + les tests serveur. Les tests de
`services/` et `app.test.ts` n'ont pas changé d'intention : s'ils échouent,
c'est le store qui ne respecte plus son contrat, pas eux.

- [ ] **Étape 6 : vérifier la stabilité**

Run : `pnpm test && pnpm test && pnpm test`
Attendu : trois passages verts d'affilée. Un test qui alterne trahit un
`TRUNCATE` manquant ou un ordre non déterministe.

- [ ] **Étape 7 : typecheck, lint, format**

Run : `pnpm typecheck && pnpm lint && pnpm exec prettier --check .`
Attendu : aucune erreur. Deux avertissements `max-lines` préexistants sur
`src/screens/DetailScreen.tsx` et `test/storage.test.ts` restent tolérés.

- [ ] **Étape 8 : vérifier de bout en bout que les données survivent**

```bash
pnpm --dir server dev &
curl -s -X POST localhost:3000/ideas -H 'Content-Type: application/json' -d '{"text":"elle doit survivre"}'
```

Arrêter le serveur, le relancer, puis :

```bash
curl -s localhost:3000/ideas
```

Attendu : l'idée est **toujours là**. C'est le seul test qui prouve la raison
d'être de cette brique — aucune suite en mémoire ne peut le faire.

- [ ] **Étape 9 : commit (PO)**

```
feat(server): persist ideas in postgres

Swap the in-memory Map for Kysely-backed tables without touching a single
line of services/, controllers/ or routes/ — the layer boundary was laid
down for exactly this. Malformed identifiers are rejected in the store: a
non-uuid would otherwise raise a 500 where the contract owes a 404.
```

---

## Tâche 5 : aligner la documentation

Trois fichiers décrivent encore un serveur sans base.

**Fichiers :**

- Modifier : `CLAUDE.md`, `.claude/rules/storage.md`,
  `.claude/rules/structure.md`, `docs/persistence-design.md`

- [ ] **Étape 1 : corriger la section Stack de `CLAUDE.md`**

Remplacer la puce « **Stockage** : `Map` en mémoire. **Rien n'est persisté** […]
La vraie persistance est un sujet ouvert, pas une omission. » par :

```markdown
- **Stockage** : PostgreSQL 17 via Docker Compose, accédé avec Kysely. Le
  schéma vit dans `server/migrations/*.sql` — c'est lui la source de vérité,
  les types TS en sont dérivés par `kysely-codegen` → voir
  `.claude/rules/storage.md`
```

- [ ] **Étape 2 : mettre `storage.md` à jour**

Dans `.claude/rules/storage.md`, ajouter au blockquote de tête :

```markdown
> Côté serveur, la **forme** du modèle vient toujours du spec OpenAPI, mais son
> **stockage** est décrit par `server/migrations/*.sql`. Ne modifie jamais
> `src/store/schema.generated.ts` : écris une migration, applique-la
> (`pnpm --dir server db:migrate`), régénère (`pnpm --dir server db:types`).
> Ce fichier généré est **commité**, contrairement à `api.generated.ts` :
> kysely-codegen introspecte une base vivante, qu'un checkout neuf sans Docker
> n'a pas.
```

- [ ] **Étape 3 : déclarer les nouveaux fichiers dans `structure.md`**

Ajouter `docker-compose.yml` à la racine de l'arborescence documentée, et sous
`server/` : `migrations/` (les `.sql` versionnés) et `test/` (le harnais
conteneurisé, hors `src/` pour rester hors du build).

- [ ] **Étape 4 : refermer les blocages de la spec**

Dans `docs/persistence-design.md`, vider la section « Notes / Blocage » de ses
deux entrées : elles viennent d'être traitées par les étapes 1 à 3.

- [ ] **Étape 5 : vérifier**

Run : `pnpm exec prettier --check . && pnpm test`
Attendu : aucune erreur, suite au vert.

- [ ] **Étape 6 : commit (PO)**

```
docs: describe the postgres storage

CLAUDE.md still announced an in-memory Map and storage.md knew only of
chrome.storage.local.
```

---

## Ce que ce plan ne fait pas

- **La bascule du front.** `IdeaRepository` reste sur `chrome.storage.local`.
  Aucune ligne de `src/` ne bouge.
- **La migration des idées déjà stockées** dans l'extension.
- **CORS**, toujours en attente d'arbitrage.
- **`source` et `tags`**, hors modèle.
- **Le déploiement.** Le Compose sert le développement local ; aucun
  hébergement, conformément au hors-scope du MVP.
