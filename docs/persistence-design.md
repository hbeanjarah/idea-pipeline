# Persistance — conception

> PostgreSQL · SQL-first · Kysely

## Pourquoi

Le store du serveur est une `Map` en mémoire : tout disparaît au redémarrage.
En l'état, le backend est **moins fiable que le `chrome.storage.local`** qu'il
est censé remplacer, et la bascule du front est impossible.

Cette conception remplace la `Map` par PostgreSQL **sans toucher aux couches
au-dessus** : `services/`, `controllers/` et `routes/` gardent leur code. La
frontière posée à la brique d'architecture est précisément là pour ça.

## Décisions actées

| Sujet            | Décision                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| Moteur           | **PostgreSQL** (docker compose, `postgres:17`)                           |
| Schéma           | **Deux tables normalisées** — `ideas`, `variations`                      |
| Source de vérité | **Le SQL.** Migrations `.sql` versionnées ; les types TS en sont dérivés |
| Accès            | **Kysely** (query builder typé) + `kysely-codegen`                       |
| Tests            | **Testcontainers**, un conteneur pour toute la suite                     |
| Invariants       | **Dans le code**, par transactions — pas de trigger                      |
| `status`         | **`text` + `CHECK`**, pas d'`ENUM` natif                                 |

### Pourquoi deux tables plutôt qu'un `jsonb`

Dans le contrat, une `Variation` porte **son propre `id`**, exposé au client, et
`PATCH /ideas/{id}/variations/{variationId}` la cible directement. Une chose qui
a une identité propre et qu'on adresse individuellement est une **entité**.

Contrepartie assumée : l'invariant « `variations` n'est jamais vide » serait
trivial en `jsonb` (`CHECK jsonb_array_length(...) >= 1`) et ne peut pas être un
`CHECK` en relationnel. Il est défendu par transaction — voir plus bas.

### Pourquoi le SQL détient la vérité

Le projet a déjà tranché deux fois dans ce sens : `docs/openapi.yaml` est la
source, les types TS en sont générés. Le même principe s'applique à la base — on
écrit le DDL, `kysely-codegen` introspecte et génère les types.

## Le schéma

```sql
-- server/migrations/001_initial.sql

CREATE TABLE ideas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status      text        NOT NULL DEFAULT 'captured'
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

Ce que chaque contrainte défend :

- **`ON DELETE CASCADE`** traduit « suppression = définitive » : la base emporte
  les variations avec l'idée.
- **`position` + `UNIQUE (idea_id, position)`** : le tri ne repose pas sur
  `created_at`, qui égalise deux variations créées dans la même milliseconde.
  L'ordre est une donnée, pas une coïncidence. `UNIQUE` protège aussi des
  courses à l'insertion.
- **`CHECK (btrim(text) <> '')`** double la validation Zod — parce qu'un jour
  quelqu'un écrira du SQL à la main.
- **`DEFAULT gen_random_uuid()`** : le contrat dit « identifiants générés par le
  serveur ». Les confier à la base en fait une seule source ; `createIdea` les
  récupère par `RETURNING`, ce qu'il fait de toute façon.

## Le store

Les six fonctions **gardent leur signature**. Tout le changement est derrière la
frontière.

### Transactions

Chaque mutation qui touche deux lignes est atomique :

```
createIdea      BEGIN  INSERT ideas RETURNING id
                       INSERT variations (position = 1)
                COMMIT

addVariation    BEGIN  INSERT variations (position = MAX + 1)
                       UPDATE ideas SET updated_at = now()
                COMMIT

editVariation   BEGIN  UPDATE variations SET text
                       UPDATE ideas SET updated_at = now()
                COMMIT

changeStatus           UPDATE ideas SET status, updated_at = now()
```

C'est la transaction de `createIdea` qui garantit « `variations` jamais vide » :
aucun endpoint ne supprime une variation, donc l'invariant tient par
construction. Il reste violable par un `INSERT` manuel en SQL — limite acceptée,
consignée ici plutôt que masquée.

### L'ordre de `listIdeas`

Le contrat fixe l'ordre : `updated_at` décroissant, `id` décroissant pour
départager. Deux idées touchées dans la même milliseconde partagent leur
`updated_at` — sans second critère, l'ordre varierait d'un appel à l'autre.

```sql
ORDER BY updated_at DESC, id DESC
```

`ideas_updated_at_idx` couvre exactement cette clause. À quelques centaines de
lignes il ne change rien en pratique ; il est là parce que l'index doit suivre la
requête, pas parce que le volume l'exige.

### Traduction ligne → domaine

Trois conversions, toutes dans `store/` :

1. **`timestamptz` → chaîne ISO 8601.** Le driver renvoie des `Date`, le contrat
   impose des chaînes. Sans `.toISOString()`, la forme de l'API change sans
   prévenir.
2. **`string` → `Status`.** `text + CHECK` fait générer `string` par
   `kysely-codegen` ; le store rétrécit. **C'est un cast**, donc l'endroit exact
   où base et domaine peuvent diverger en silence — d'où le garde-fou ci-dessous.
3. **Assemblage** des variations triées par `position`.

### Garde-fou : la liste des statuts

Elle existera dans **deux sources déclaratives** — `docs/openapi.yaml` (d'où
vient `STATUSES`) et la contrainte `CHECK` de la migration. Aucune ne peut
raisonnablement dériver de l'autre.

Un test lit les valeurs de la contrainte dans `pg_constraint` et les compare à
`STATUSES`. Même réflexe que le contrôle croisé des 9 messages d'erreur : la
duplication reste, mais elle ne peut plus diverger en silence.

## Migrations et génération de types

```
server/migrations/001_initial.sql     ← LA source
        │
        ├── pnpm db:migrate           applique les migrations
        │
        └── pnpm db:types             kysely-codegen introspecte la base
                 └── src/store/schema.generated.ts
```

**Ce fichier généré est commité** — à l'inverse de `api.generated.ts`, qui est
gitignoré et recréé par le hook `prepare`. La raison : `kysely-codegen`
introspecte une **base vivante**. Sur un checkout neuf sans Docker démarré, il ne
pourrait pas tourner, et `typecheck` échouerait. Deux fichiers générés, deux
politiques opposées, pour une raison précise — à écrire dans `storage.md` pour
que ça ne passe pas pour une incohérence.

Le runner de migrations utilise l'API de migration de Kysely en lisant les
fichiers `.sql` — pas de dépendance supplémentaire.

## Tests

**Un conteneur pour toute la suite.** Démarrage au lancement de `pnpm test`,
migrations jouées, `TRUNCATE ... CASCADE` entre chaque test, destruction à la
fin.

`vi.resetModules()` ne suffit plus : un module neuf ne vide pas une base. C'est
le `TRUNCATE` qui porte désormais l'isolation, et il doit être **impossible à
oublier** — donc dans un `beforeEach` global du projet vitest serveur, jamais
fichier par fichier.

Impact sur l'existant : les **50 tests du serveur** passent au vert sans changer
d'intention. Seule l'isolation change de mécanisme. Les 34 tests du front vivent
dans un projet vitest distinct et n'ont besoin d'aucune base — mais `pnpm test`
lance les deux, donc un Docker absent fait échouer la commande entière.

| Fichier                  | Tests | Base requise  |
| ------------------------ | ----- | ------------- |
| `services/ideas.test.ts` | 23    | partiellement |
| `app.test.ts`            | 17    | oui           |
| `store/ideas.test.ts`    | 6     | oui           |
| `routes/ideas.test.ts`   | 2     | non           |
| `domain/types.test.ts`   | 2     | non           |

Coût assumé : `pnpm test` passe de **342 ms à quelques secondes**, et exige
Docker — y compris pour les 4 tests qui n'en ont pas besoin.

## Dépendances à installer

**Installation manuelle, cf. `.claude/rules/dependencies.md`.**

```bash
pnpm --dir server add kysely pg
pnpm --dir server add -D @types/pg kysely-codegen testcontainers
```

- `kysely` + `pg` — runtime : le query builder et le driver.
- `kysely-codegen` — génération des types depuis la base.
- `testcontainers` — conteneur éphémère pour les tests.

## Hors périmètre

- **La bascule du front.** `IdeaRepository` reste sur `chrome.storage.local`.
  Aucune ligne de `src/` ne bouge.
- **La migration des idées déjà stockées** dans l'extension. Sujet réel, à
  traiter avec la bascule — pas avant.
- **CORS**, toujours en attente.
- **`source` et `tags`** restent hors modèle (`storage.md`).

## Notes / Blocage

- `CLAUDE.md` annonce encore un stockage `Map` en mémoire dans la section Stack ;
  `storage.md` devra décrire la nouvelle source de vérité.
- Docker entre dans le dépôt (`docker-compose.yml`) : nouvelle catégorie de
  fichier, à déclarer dans `structure.md`.
