# Étapes configurables — plan d'implémentation

Met en œuvre `docs/labels-design.md` : le statut figé à quatre valeurs devient
une liste que chaque compte écrit. Une idée est à une seule étape, ou à aucune.

Lis la conception d'abord — ce plan argumente depuis elle et ne la répète pas.

## Qui fait quoi

| Qui        | Quoi                                                       |
| ---------- | ---------------------------------------------------------- |
| **PO**     | lance les commandes serveur et base, colle les sorties     |
| **PO**     | Git : commits, branches, pousse                            |
| **PO**     | la reprise en production (tâche 15)                        |
| **Claude** | le code, les tests, la documentation, le texte des commits |

**Aucune dépendance à installer.** Tout se fait avec la pile en place.

## Le fait qui dicte l'ordre

La tâche 6 change le format sur le fil côté serveur (`status` → `labelId`). La
tâche 9 le change côté panneau.

> **Entre les deux, l'application est cassée à l'exécution.** `pnpm typecheck`
> reste vert — les deux fichiers de types sont écrits à la main et indépendants
> — donc **rien ne t'avertira**. C'est le compilateur qui ne peut pas voir cette
> frontière.

Conséquence : **ne déploie rien entre la tâche 6 et la tâche 13.** En local, le
panneau restera inutilisable pendant ce temps ; c'est attendu.

L'autre ordre, celui qui ne se rattrape pas :

> **La colonne `ideas.status` se supprime en dernier — tâche 16, après la
> production.** Le script de reprise la lit ; le supprimer plus tôt tue le
> script avant que la production l'ait lancé, et le classement des idées
> existantes serait perdu sans retour. C'est la leçon de la tâche 7 du plan
> sécurité.

---

## Lot 1 — La base

Rien ne change de comportement. On pose les tables et le store, on les prouve.

### Tâche 1 : les deux tables

**Pourquoi.** Le schéma est la source de vérité (`storage.md`) ; les types TS en
sont dérivés. Rien ne peut être écrit avant.

- [ ] Créer `server/migrations/003_labels.sql` :

```sql
CREATE TABLE labels (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text        NOT NULL,
  color      integer     NOT NULL CHECK (color BETWEEN 1 AND 8),
  position   integer     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX labels_user_id_idx ON labels (user_id, position);

CREATE TABLE idea_labels (
  idea_id  uuid NOT NULL REFERENCES ideas  (id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, label_id),
  CONSTRAINT idea_labels_one_per_idea UNIQUE (idea_id)
);

CREATE INDEX idea_labels_label_id_idx ON idea_labels (label_id);
```

> Pas d'unicité sur `position` : réordonner échange des positions et la
> violerait le temps d'une transaction, ce qui imposerait une contrainte
> différée. On trie sur `position, id`.

**Vérification** — à lancer par le PO, dans cet ordre :

```bash
cd server && pnpm run db:migrate && pnpm run db:types
```

- [ ] `schema.generated.ts` contient `labels` et `idea_labels`.
- [ ] `pnpm --dir server typecheck` vert.

> L'ordre compte : régénérer contre une base non migrée ne lève aucune erreur,
> ça produit une interface `DB` **vide** (`storage.md`).

---

### Tâche 2 : le store des étapes

**Pourquoi.** Les cinq opérations, et le seul endroit qui appelle `seal` pour un
nom d'étape.

- [ ] Renommer le second paramètre de `seal` et `open` dans
      `server/src/store/notes.ts` : `ideaId` devient `context`.

> Il ne porte plus seulement un identifiant d'idée. Laisser `ideaId` alors qu'on
> lui passe un `userId` rendrait le prochain lecteur fou. Aucun appelant ne
> change — seule la signature se relit.

- [ ] Créer `server/src/store/labels.ts` :

```ts
import type { Selectable } from 'kysely';

import type { Label } from '#domain/types';
import { db } from '#store/db';
import { open, seal } from '#store/notes';
import type { DB } from '#store/schema.generated';

type LabelRow = Selectable<DB['labels']>;

const PALETTE = 8;

const toLabel = (row: LabelRow): Label => ({
  id: row.id,
  // Scelle avec le user_id : l'id de la ligne n'existe pas encore au moment de
  // l'insertion, et la protection est la meme — une etiquette recopiee dans un
  // autre compte ne s'ouvre pas.
  name: open(row.name, row.user_id),
  color: row.color,
  position: row.position,
});

// La premiere des huit qui n'est pas prise. Compter les etiquettes et prendre
// la suivante se trompe des la premiere suppression : 1-2-3-4, on retire la 2,
// on cree, et la nouvelle reprend 4 alors que 2 est libre.
function nextColor(used: number[]): number {
  for (let color = 1; color <= PALETTE; color += 1) {
    if (!used.includes(color)) return color;
  }
  return (used.length % PALETTE) + 1;
}

export async function listLabels(userId: string): Promise<Label[]> {
  const rows = await db()
    .selectFrom('labels')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('position')
    .orderBy('id')
    .execute();

  return rows.map(toLabel);
}

export async function createLabel(
  userId: string,
  name: string,
): Promise<Label> {
  const existing = await listLabels(userId);

  const row = await db()
    .insertInto('labels')
    .values({
      user_id: userId,
      name: seal(name, userId),
      color: nextColor(existing.map((label) => label.color)),
      // Au-dela du plus haut, pas au-dela du nombre : apres une suppression,
      // le nombre tombe sur une position deja prise.
      position:
        existing.reduce(
          (highest, label) => Math.max(highest, label.position),
          0,
        ) + 1,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toLabel(row);
}

export async function renameLabel(
  userId: string,
  id: string,
  name: string,
): Promise<Label | null> {
  const row = await db()
    .updateTable('labels')
    .set({ name: seal(name, userId) })
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();

  return row ? toLabel(row) : null;
}

export async function deleteLabel(
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await db()
    .deleteFrom('labels')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return Number(result.numDeletedRows) > 0;
}

export async function reorderLabels(
  userId: string,
  ids: string[],
): Promise<Label[]> {
  await db()
    .transaction()
    .execute(async (trx) => {
      for (const [index, id] of ids.entries()) {
        await trx
          .updateTable('labels')
          .set({ position: index + 1 })
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .execute();
      }
    });

  return listLabels(userId);
}
```

- [ ] **Le schéma `Label` entre d'abord dans `docs/openapi.yaml`.**
      `server/src/domain/types.ts` n'est pas un fichier de types écrits à la
      main : c'est une façade qui réexporte les types **générés** depuis le
      spec. Le store ne peut pas nommer `Label` avant qu'il existe là.

```yaml
Label:
  type: object
  required: [id, name, color, position]
  properties:
    id: { type: string, format: uuid }
    name: { type: string, minLength: 1, maxLength: 32 }
    color: { type: integer, minimum: 1, maximum: 8 }
    position: { type: integer, minimum: 1 }
```

Puis `pnpm --dir server generate:types`, et ajouter `Label` à la liste
réexportée par `server/src/domain/types.ts`.

> Seul le **schéma** entre ici. Les chemins `/labels` restent à la tâche 4,
> avec les routes qui les servent.

- [ ] Extraire le garde d'identifiant dans `server/src/store/uuid.ts`. Il vit
      aujourd'hui dans `ideas.ts` avec sa raison — _« Postgres raises on a
      malformed uuid instead of returning no row »_ — et `labels.ts` en a le
      même besoin : sans lui, `renameLabel('pas-un-uuid')` rend un **500** là
      où le contrat doit un 404. C'est le 2ᵉ cas réel, donc on factorise.
      Migrer les cinq appels d'`ideas.ts`.

- [ ] Écrire `server/src/store/labels.test.ts` :

| Cas                                      | Attendu                                 |
| ---------------------------------------- | --------------------------------------- |
| `listLabels` sur un compte neuf          | `[]`                                    |
| Créer trois étapes                       | positions 1, 2, 3 · couleurs 1, 2, 3    |
| Supprimer la 2ᵉ puis créer               | la nouvelle prend la **couleur 2**      |
| Neuf créations                           | la 9ᵉ reprend une couleur, sans jeter   |
| Renommer                                 | le nom change, l'`id` et la couleur non |
| Renommer l'étape d'un autre compte       | `null`                                  |
| Supprimer l'étape d'un autre compte      | `false`                                 |
| `reorderLabels` avec l'ordre inversé     | `position` renumérotée 1..n             |
| Lier deux fois la même idée (SQL direct) | viole `idea_labels_one_per_idea`        |
| Supprimer une étape liée à des idées     | les idées survivent, les liens non      |

**Vérification**

- [ ] `pnpm test` vert.
- [ ] Prouver que les tests mordent, en cassant volontairement le code :
      remplacer `nextColor` par sa version naïve doit faire rougir **le seul**
      test des couleurs, et `position: existing.length + 1` **le seul** test des
      positions. S'ils rougissent en bloc, ils ne visent rien.

---

### Tâche 3 : le test qui prouve

**Pourquoi.** `sealed-at-rest.test.ts` est la seule protection contre un chemin
d'écriture qui oublierait de chiffrer. Il ne regarde aujourd'hui que
`variations.text` ; sans extension, il ne regarderait pas la nouvelle table.

- [ ] Étendre `server/src/store/sealed-at-rest.test.ts` :

```ts
// SQL brut, comme pour les variations : passer par le store appellerait
// toLabel, qui dechiffre. Le but est de voir ce que Postgres detient vraiment.
const storedNames = async (userId: string): Promise<string[]> => {
  const { rows } = await sql<{
    name: string;
  }>`SELECT name FROM labels WHERE user_id = ${userId} ORDER BY position`.execute(
    db(),
  );

  return rows.map((row) => row.name);
};
```

| Cas                         | Attendu                               |
| --------------------------- | ------------------------------------- |
| `createLabel(user, MARKER)` | la ligne commence par `v1.`           |
| idem                        | la ligne **ne contient pas** `MARKER` |
| `renameLabel` vers `MARKER` | idem                                  |
| `listLabels` après ça       | rend `MARKER` en clair                |

Avec `const MARKER = 'CONFIDENTIEL-marqueur-unique-42'`, comme pour les
variations.

**Vérification**

- [ ] `pnpm test` vert.
- [ ] Prouver que le garde-fou mord, en retirant le `seal` de chaque chemin
      d'écriture tour à tour :

| Sabotage                     | Rouges | Pourquoi                                                            |
| ---------------------------- | ------ | ------------------------------------------------------------------- |
| `createLabel` ne scelle plus | **4**  | tous les tests d'étape passent par la création : l'échec se propage |
| `renameLabel` ne scelle plus | **1**  | seul chemin touché, échec précis                                    |

> Même signature que dans la brique sécurité : la voie de création fait tomber
> tout le bloc, la voie de correction tombe seule. Si le sabotage de
> `createLabel` ne fait rougir qu'un test, c'est que les autres ne lisent pas
> vraiment la base.

---

## Lot 2 — Le contrat et l'API

### Tâches 4 et 5 : le spec et les routes — **indissociables**

> `server/src/routes/contract.test.ts` compare les opérations **déclarées dans
> le spec** aux routes **réellement montées dans Express**, et exige l'égalité
> exacte. Déclarer un chemin sans le servir rend le test rouge. Les deux tâches
> se font et se commitent ensemble.

### Tâche 4 : le spec

**Pourquoi.** `docs/openapi.yaml` fait foi pour la forme du modèle, et les types
serveur en sont générés. Il passe avant le code qui les utilise.

> Le schéma `Label` est déjà dans le spec — il est entré à la tâche 2, parce
> que le store ne pouvait pas le nommer avant. Cette tâche n'ajoute que les
> chemins.

- [ ] Remplacer `status` par `labelId` dans le schéma `Idea` :

```yaml
labelId:
  type: string
  format: uuid
  nullable: true
```

- [ ] Ajouter les chemins `/labels` (`listLabels`, `createLabel`,
      `reorderLabels`) et `/labels/{id}` (`renameLabel`, `deleteLabel`), aux
      conventions en place : `operationId` en camelCase, `summary` en français.
  > **La bascule `status` → `labelId` n'est PAS ici.** Elle casserait `toIdea`
  > dans `ideas.ts` jusqu'à la tâche 6, et une tâche doit se terminer verte. Le
  > schéma `Idea`, `ChangeStatusRequest` et le retrait de `Status` partent
  > entiers à la tâche 6, spec et store d'un bloc. Cette tâche n'est
  > qu'**additive**.
- [ ] Ajouter les cinq messages à la table exhaustive de `docs/api-design.md` :

| Cas                                   | Code  | Message                                 |
| ------------------------------------- | ----- | --------------------------------------- |
| `name` absent, vide ou espaces        | `400` | « Le nom de l'étape est obligatoire. »  |
| `name` de plus de 32 caractères       | `400` | « Le nom de l'étape est trop long. »    |
| `name` déjà porté par une autre étape | `400` | « Cette étape existe déjà. »            |
| `labelId` ou `id` inconnu             | `404` | « Étape introuvable. »                  |
| `ids` incomplet                       | `400` | « La liste des étapes est incomplète. » |

**Vérification**

```bash
pnpm --dir server generate:types
```

- [ ] `api.generated.ts` porte `Label` et `Idea.labelId`.
- [ ] Le test qui compare la copie locale au spec passe.

---

### Tâche 5 : `/labels` de bout en bout

**Pourquoi.** La ressource complète, à travers les quatre couches, dans l'ordre
qu'impose `structure.md`.

- [ ] Créer `server/src/services/labels.ts` :

```ts
import { z } from 'zod';

import { ApiError } from '#config/api-error';
import * as store from '#store/labels';

const Name = z.string().trim().min(1).max(32);

const CreateLabel = z.strictObject({ name: Name });
const RenameLabel = z.strictObject({ name: Name });
const Reorder = z.strictObject({
  ids: z.array(z.string().uuid()).min(1),
});

// L'unicite ne peut pas etre une contrainte SQL : chaque scellement utilise un
// IV neuf, donc deux « Pret » produisent deux chiffres differents et un index
// unique ne verrait rien. On compare donc les noms dechiffres.
// Casse ignoree, accents NON replies — meme regle que la recherche (filterIdeas).
const same = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export async function list(userId: string) {
  return store.listLabels(userId);
}

export async function create(userId: string, body: unknown) {
  const parsed = CreateLabel.safeParse(body);
  if (!parsed.success)
    throw new ApiError(400, "Le nom de l'étape est obligatoire.");

  const existing = await store.listLabels(userId);
  if (existing.some((label) => same(label.name, parsed.data.name)))
    throw new ApiError(400, 'Cette étape existe déjà.');

  return store.createLabel(userId, parsed.data.name);
}

export async function rename(
  userId: string,
  id: string,
  body: unknown,
) {
  const parsed = RenameLabel.safeParse(body);
  if (!parsed.success)
    throw new ApiError(400, "Le nom de l'étape est obligatoire.");

  const existing = await store.listLabels(userId);
  // L'etiquette elle-meme est exclue : se renommer en soi-meme n'est pas un
  // doublon.
  if (
    existing.some(
      (label) =>
        label.id !== id && same(label.name, parsed.data.name),
    )
  )
    throw new ApiError(400, 'Cette étape existe déjà.');

  const label = await store.renameLabel(userId, id, parsed.data.name);
  if (!label) throw new ApiError(404, 'Étape introuvable.');

  return label;
}

export async function remove(userId: string, id: string) {
  const deleted = await store.deleteLabel(userId, id);
  if (!deleted) throw new ApiError(404, 'Étape introuvable.');
}

export async function reorder(userId: string, body: unknown) {
  const parsed = Reorder.safeParse(body);
  if (!parsed.success)
    throw new ApiError(400, 'La liste des étapes est incomplète.');

  const existing = await store.listLabels(userId);
  const known = new Set(existing.map((label) => label.id));
  const given = new Set(parsed.data.ids);

  // Exactement le meme ensemble : une liste partielle laisserait des positions
  // orphelines, une liste enflee ecrirait dans le vide.
  if (
    given.size !== known.size ||
    [...given].some((id) => !known.has(id))
  )
    throw new ApiError(400, 'La liste des étapes est incomplète.');

  return store.reorderLabels(userId, parsed.data.ids);
}
```

> Le `maxLength: 32` de Zod et celui d'OpenAPI doivent rester identiques : deux
> écritures d'une même règle, comme le couple `docs/openapi.yaml` ↔ services.

- [ ] Créer `server/src/controllers/labels.ts` et `server/src/routes/labels.ts`,
      calqués sur ceux des idées. Monter le routeur dans `server/src/app.ts`
      **avant** `not-found`, et ajouter `labelsRouter` à la liste `MOUNTED` de
      `server/src/routes/contract.test.ts`.

- [ ] **Extraire le harnais HTTP** dans `server/test/http.ts`. `app.test.ts` le
      portait seul ; les étapes en ont besoin aussi, et c'est le 2ᵉ cas réel.
      Sans l'extraction, `app.test.ts` couvre deux ressources et franchit le
      seuil `max-lines` — le signal exact que la règle existe pour donner.

- [ ] Écrire `server/src/routes/labels.test.ts`, au niveau **HTTP**. Les tests
      de service ne touchent jamais `routes/` ni `controllers/` : un contrôleur
      branché sur le mauvais verbe leur échappe entièrement. Couvrir en
      particulier `PATCH /labels` contre `PATCH /labels/{id}` — un caractère
      d'écart, deux contrôleurs différents.
- [ ] Écrire `server/src/services/labels.test.ts` :

| Cas                                         | Attendu                                     |
| ------------------------------------------- | ------------------------------------------- |
| `create` avec `{}`                          | 400 « Le nom de l'étape est obligatoire. »  |
| `create` avec `{ name: '   ' }`             | 400, même message                           |
| `create` avec 33 caractères                 | 400 « Le nom de l'étape est trop long. »    |
| `create` avec un champ en trop              | 400                                         |
| `create` « Prêt » alors que « prêt » existe | 400 « Cette étape existe déjà. »            |
| `create` « Pret » alors que « Prêt » existe | **201** — accents non repliés               |
| `rename` vers son propre nom                | 200, pas un doublon                         |
| `rename` d'un id inconnu                    | 404 « Étape introuvable. »                  |
| `remove` d'un id inconnu                    | 404                                         |
| `reorder` avec un id manquant               | 400 « La liste des étapes est incomplète. » |
| `reorder` avec un id étranger               | 400                                         |
| `reorder` avec le bon ensemble inversé      | 200, positions renumérotées                 |

> Le message « trop long » suppose que Zod distingue les deux échecs. Si
> `safeParse` ne permet pas de les séparer proprement, valider la longueur
> après le `min(1)` par un test explicite sur `parsed.error.issues`.

**Vérification**

- [ ] `pnpm test` vert.
- [ ] Prouver que les tests HTTP mordent : échanger `reorder` et `rename` dans
      `routes/labels.ts`. Les **23 tests de service restent verts** ; seuls les
      tests HTTP rougissent. C'est la seule couche qui voit ce câblage.

---

### Tâche 6 : l'idée porte une étape

**Pourquoi.** C'est ici que le format sur le fil change. Relis « Le fait qui
dicte l'ordre » avant de commencer.

- [ ] Dans `server/src/store/ideas.ts` :
  - `toIdea` prend un `labelId: string | null` en argument au lieu de lire
    `row.status`. Le cast `row.status as Status` et son commentaire disparaissent.
  - `listIdeas` gagne une **troisième requête**, calquée sur celle des variations :

```ts
const links = await db()
  .selectFrom('idea_labels')
  .selectAll()
  .where(
    'idea_id',
    'in',
    rows.map((row) => row.id),
  )
  .execute();

const labelOf = new Map(
  links.map((link) => [link.idea_id, link.label_id]),
);
```

- `changeStatus` devient `setLabel(userId, id, labelId)` :

```ts
// Supprimer puis inserer, dans une transaction : la contrainte
// idea_labels_one_per_idea refuserait une seconde ligne, et un upsert
// demanderait de nommer la contrainte dans la requete.
export async function setLabel(
  userId: string,
  id: string,
  labelId: string | null,
): Promise<Idea | null> {
  if (!UUID.test(id)) return null;

  const idea = await db()
    .selectFrom('ideas')
    .selectAll()
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!idea) return null;

  await db()
    .transaction()
    .execute(async (trx) => {
      await trx
        .deleteFrom('idea_labels')
        .where('idea_id', '=', id)
        .execute();

      if (labelId !== null) {
        await trx
          .insertInto('idea_labels')
          .values({ idea_id: id, label_id: labelId })
          .execute();
      }

      await trx
        .updateTable('ideas')
        .set({ updated_at: touch() })
        .where('id', '=', id)
        .execute();
    });

  return readIdea(userId, id);
}
```

- [ ] Le service `setIdeaLabel` vérifie que `labelId`, s'il n'est pas `null`,
      appartient au compte — sinon `404 « Étape introuvable. »`. Sans ce
      contrôle, la clé étrangère lèverait une 500 sur un id inconnu, et une
      étiquette d'autrui serait acceptée en silence.
- [ ] Mettre à jour `server/src/domain/types.ts` : `Idea.status` → `Idea.labelId`,
      et supprimer le type `Status`.
- [ ] Supprimer `server/src/store/status-constraint.test.ts`.

| Cas                                       | Attendu                                    |
| ----------------------------------------- | ------------------------------------------ |
| Idée neuve                                | `labelId === null`                         |
| `setLabel` vers une étape du compte       | `labelId` renseigné, `updatedAt` rafraîchi |
| `setLabel` deux fois de suite             | une seule ligne dans `idea_labels`         |
| `setLabel(null)` après coup               | `labelId === null`, l'idée intacte         |
| `setLabel` vers l'étape d'un autre compte | 404                                        |
| Supprimer l'étape                         | l'idée revient à `labelId === null`        |

**Vérification**

- [ ] `pnpm test` vert, **y compris les tests d'idées existants** qui ne parlent
      pas d'étapes : s'ils cassent, le changement a débordé du store.
- [ ] `pnpm --dir server typecheck` vert. Le panneau, lui, est cassé — c'est
      attendu jusqu'à la tâche 13.

---

## Lot 3 — La reprise

> La suppression de la colonne `ideas.status` **ne fait pas partie de ce lot**.
> Elle est devenue la tâche 16, en toute fin de plan : voir la raison là-bas.

### Tâche 7 : les quatre étapes par défaut

**Pourquoi.** Deux populations, une seule règle. Un compte neuf reçoit ses
quatre étapes **à la création** ; un compte existant les reçoit par un script
qui convertit en plus son `status`. Le but est qu'ils soient **indiscernables**
ensuite — un seul cas à tester dans tout le reste du plan.

La conversion ne peut pas être du SQL : **le nom d'une étiquette est chiffré**.

- [ ] Ajouter à `server/src/store/labels.ts` la graine, partagée par les deux
      chemins :

```ts
// Les quatre etapes historiques. Scellees comme les autres : des le premier
// renommage elles deviennent du contenu utilisateur, et un seul chemin vaut
// mieux que deux.
export const DEFAULT_LABELS = [
  'Capturé',
  'Maturation',
  'Prêt',
  'Publié',
] as const;

export async function seedDefaultLabels(
  userId: string,
  trx: Kysely<DB> = db(),
): Promise<Label[]> {
  const rows = await trx
    .insertInto('labels')
    .values(
      DEFAULT_LABELS.map((name, index) => ({
        user_id: userId,
        name: seal(name, userId),
        color: index + 1,
        position: index + 1,
      })),
    )
    .returningAll()
    .execute();

  return rows.map(toLabel);
}
```

- [ ] Semer **à la création du compte**, dans `server/src/store/users.ts`.
      `upsertUser` fait un `ON CONFLICT … DO UPDATE` : il rend la même forme
      qu'il ait créé ou retrouvé le compte, donc il faut distinguer les deux.

```ts
export async function upsertUser(
  googleSub: string,
  email: string,
): Promise<StoredUser> {
  return db()
    .transaction()
    .execute(async (trx) => {
      const row = await trx
        .insertInto('users')
        .values({ google_sub: googleSub, email })
        .onConflict((conflict) =>
          conflict.column('google_sub').doUpdateSet({ email }),
        )
        // xmax vaut 0 sur une ligne reellement inseree, et porte l'id de
        // transaction sur une ligne mise a jour. C'est la seule facon de savoir
        // ce qu'un upsert vient de faire.
        .returning([
          'id',
          'email',
          sql<boolean>`xmax = 0`.as('created'),
        ])
        .executeTakeFirstOrThrow();

      // Semer sur « created » et non sur « ce compte n'a aucune etape » :
      // zero etape est un etat legal, et quelqu'un qui les a toutes supprimees
      // ne doit pas les voir revenir a chaque connexion.
      if (row.created) await seedDefaultLabels(row.id, trx);

      return { id: row.id, email: row.email };
    });
}
```

> Dans la même transaction que l'insertion : hors transaction, un compte
> pourrait naître sans étapes si la seconde écriture échoue.

- [ ] Créer `server/src/store/adopt-labels.ts` :

```ts
const BY_STATUS: Record<string, number> = {
  captured: 0,
  maturing: 1,
  ready: 2,
  published: 3,
};

export async function adoptLabels(): Promise<{
  seeded: number;
  skipped: number;
  linked: number;
}> {
  const users = await db().selectFrom('users').select('id').execute();
  let seeded = 0;
  let skipped = 0;
  let linked = 0;

  for (const user of users) {
    await db()
      .transaction()
      .execute(async (trx) => {
        const existing = await trx
          .selectFrom('labels')
          .select('id')
          .where('user_id', '=', user.id)
          .executeTakeFirst();

        // Ce test est tout ce qui rend le script rejouable : un compte deja
        // pourvu est laisse intact, liens compris.
        if (existing) {
          skipped += 1;
          return;
        }

        const labels = await seedDefaultLabels(user.id, trx);
        seeded += 1;

        // SQL brut pour lire `status`, volontairement : ce script survit ainsi
        // a la tache 8, qui supprime la colonne et donc la retire de
        // schema.generated.ts. Passer par Kysely le rendrait incompilable des
        // que la migration serait jouee — et il faudrait deux deploiements en
        // production au lieu d'un.
        const { rows: ideas } = await sql<{
          id: string;
          status: string;
        }>`SELECT id, status FROM ideas WHERE user_id = ${user.id}`.execute(
          trx,
        );

        for (const idea of ideas) {
          const index = BY_STATUS[idea.status];
          const label =
            index === undefined ? undefined : labels[index];
          if (!label) continue;

          await trx
            .insertInto('idea_labels')
            .values({ idea_id: idea.id, label_id: label.id })
            .execute();
          linked += 1;
        }
      });
  }

  return { seeded, skipped, linked };
}
```

- [ ] Créer `server/src/store/adopt-labels-cli.ts` sur le modèle de
      `seal-cli.ts`, et ajouter le script :

```json
"db:labels": "tsx --env-file=.env --conditions=development src/store/adopt-labels-cli.ts"
```

Il affiche `Comptes pourvus: N. Déjà pourvus: M. Liens créés: K.`

- [ ] Écrire `server/src/store/adopt-labels.test.ts` :

| Cas                                              | Attendu                                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| Un compte existant, 3 idées de statuts distincts | 4 étapes, 3 liens                                      |
| Rejouer le script                                | `Déjà pourvus: 1`, 0 lien de plus                      |
| Deux comptes                                     | 4 étapes **chacun**, aucun croisement                  |
| Un compte sans idée                              | 4 étapes, 0 lien                                       |
| Un compte qui a supprimé toutes ses étapes       | **laissé vide** — pas de re-semis                      |
| Les noms en base                                 | commencent par `v1.`                                   |
| `listLabels` après reprise                       | « Capturé · Maturation · Prêt · Publié », dans l'ordre |

- [ ] Écrire dans `server/src/store/users.test.ts` :

| Cas                                   | Attendu                          |
| ------------------------------------- | -------------------------------- |
| Première connexion d'un compte        | 4 étapes créées                  |
| Seconde connexion du même compte      | toujours 4 — pas de doublon      |
| Connexion après suppression de toutes | **0 étape**, rien ne revient     |
| Changement d'e-mail chez Google       | le compte est retrouvé, 4 étapes |

**Vérification**

- [ ] `pnpm test` vert.
- [ ] En local : `pnpm --dir server db:labels`, puis relancer — la seconde passe
      doit annoncer `Déjà pourvus` pour tous les comptes.
- [ ] Supprimer toutes ses étapes dans le panneau, se déconnecter, se
      reconnecter : **elles ne doivent pas revenir**. Si elles reviennent, le
      semis s'appuie sur « aucune étape » au lieu de « compte créé ».

---

## Lot 4 — Le panneau

> **Ce lot est une seule unité de compilation.** Côté serveur, la bascule
> `status` → `labelId` s'est absorbée dans `store/ideas.ts` et tout ce qui était
> au-dessus a continué de compiler. Le panneau n'a pas de couture équivalente :
> `Idea` est consommé directement par les composants, les écrans, les hooks et
> `lib/`, donc le changement touche seize fichiers d'un coup.
>
> **Seule la tâche 13 se termine verte.** Les tâches 9 à 12 sont des points de
> revue, pas des états livrables, et le lot se commite d'un bloc.

### Tâche 9 : le tuyau, et la mort de `storage.ts`

**Pourquoi.** Le contrat panneau ↔ worker se déclare d'abord (`structure.md`) ;
tout le reste du lot s'appuie dessus.

- [ ] Dans `src/storage/types.ts` : supprimer `Status`, ajouter `Label`
      (`id`, `name`, `color: number`, `position: number`), remplacer
      `Idea.status` par `Idea.labelId: string | null`.
- [ ] Dans `src/lib/protocol.ts` : remplacer `ideas/changeStatus` par
      `ideas/setLabel` (`{ ideaId, labelId: string | null }`), ajouter
      `labels/list`, `labels/create`, `labels/rename`, `labels/delete`,
      `labels/reorder`, et leurs entrées dans `ReplyData` :

```ts
'labels/list': Label[];
'labels/create': Label;
'labels/rename': Label;
'labels/delete': null;
'labels/reorder': Label[];
```

- [ ] Un cas par message dans `src/background/messages.ts`, un appel par message
      dans `src/background/api.ts`.
- [ ] Dans `src/storage/remote.ts` : `changeStatus` devient `setLabel`, et un
      `labelRepository` expose les cinq opérations.
- [ ] **Supprimer** `src/storage/storage.ts` et `test/storage.test.ts`, ainsi
      que l'interface `IdeaRepository` qu'il portait si elle vit là.
- [ ] Mettre à jour `test/messages.test.ts`, `test/api.test.ts`,
      `test/remote.test.ts`.

**Vérification**

- [ ] `pnpm test` vert · `pnpm typecheck` vert.
- [ ] `grep -rn "chrome.storage.local" src/` ne rend plus que le service worker
      (session) — plus aucune idée n'y transite.

---

### Tâche 10 : `LabelsProvider`

**Pourquoi.** Trois écrans lisent les étapes. C'est l'argument qui a déjà
justifié `IdeasProvider`.

- [ ] Créer `src/hooks/LabelsProvider.tsx` et `src/hooks/useLabels.ts`, sur le
      modèle d'`IdeasProvider` : `labels`, `loading`, l'échec exposé via
      `useFailureRetry`, et `create`, `rename`, `remove`, `reorder`.
- [ ] Le réordonnancement est **optimiste** : la liste se réarrange tout de
      suite et se remet en place si l'appel échoue. Sans ça, une flèche
      cliquée met un aller-retour réseau à bouger.
- [ ] Monter le provider dans `src/sidepanel/App.tsx`, autour d'`IdeasProvider`.
- [ ] Dans `IdeasProvider`, l'entrée optimiste pose `labelId: null` — la
      devinette du statut initial disparaît.

| Cas                        | Attendu                                |
| -------------------------- | -------------------------------------- |
| Montage                    | `labels` chargées une fois             |
| `create` puis échec réseau | l'étape disparaît, l'échec est exposé  |
| `reorder` optimiste        | l'ordre change avant la réponse        |
| `reorder` qui échoue       | l'ordre **revient** à l'état précédent |

**Vérification**

- [ ] `pnpm test` vert.

---

### Tâche 11 : la carte cesse d'être un bouton

**Pourquoi.** `Popover` enveloppe son déclencheur dans un `<button>`, et
`IdeaCard` **est** un `<button>`. Un bouton imbriqué est du HTML invalide : le
navigateur ferme le bouton extérieur trop tôt, la mise en page casse et les
clics partent ailleurs.

- [ ] Renommer `src/components/StatusPicker/` en `LabelPicker/`. Il reçoit
      `labels: Label[]`, `labelId: string | null`, `onChange(labelId | null)`.
      Il rend « Aucune étape » en tête, puis la liste. Sur une liste vide, il
      propose de créer une première étape.
- [ ] Le déclencheur porte **un chevron dans les deux états** : pastille pleine + nom quand une étape est posée, pastille creuse + « Classer » sinon.
      Même fond (`--tagbg`), même rayon, même taille — rien ne se décale.
- [ ] Restructurer `src/components/IdeaCard/IdeaCard.tsx` :

```tsx
<div
  className={[
    styles.card,
    pending && styles.pending,
    selected && styles.selected,
  ]
    .filter(Boolean)
    .join(' ')}
>
  <button type="button" className={styles.open} onClick={onClick}>
    <span className={styles.text}>{text}</span>
  </button>
  <div className={styles.meta}>
    <LabelPicker
      labels={labels}
      labelId={idea.labelId}
      onChange={onLabelChange}
    />
    {versionCount > 1 && (
      <span className={styles.versions}>{versionCount} versions</span>
    )}
  </div>
</div>
```

- [ ] Dans `src/styles/tokens.css` : remplacer les quatre `--status-*` par
      `--label-1` … `--label-8`. Les quatre premières gardent les valeurs
      actuelles (`--taupe`, `--violet`, `--accent`, `--ink`) ; les quatre
      nouvelles sont `#4b7ca8`, `#5f8a63`, `#9c5f7e`, `#8a6b3f`.
- [ ] Supprimer `src/lib/statusLabels.ts` et `test/statusLabels.test.ts`.

**Vérification**

- [ ] `pnpm build`, puis charger l'extension : cliquer l'étiquette ouvre le menu
      **sans** ouvrir l'idée ; cliquer le texte ouvre l'idée.
- [ ] Au clavier : deux arrêts de tabulation par carte, dans l'ordre texte puis
      étiquette.
- [ ] Dans les outils de développement, l'inspecteur ne signale **aucun**
      `<button>` imbriqué.

---

### Tâche 12 : le filtre sur une rangée

**Pourquoi.** `Tous` + `Sans étape` + N étapes ne tiennent plus sur une ligne, et
la note de `StatusFilter.module.css` interdit qu'une pastille disparaisse sans
que l'utilisateur le sache. Une icône qui annonce le reste respecte cette
intention.

- [ ] Renommer `src/components/StatusFilter/` en `LabelFilter/`.
- [ ] Mesurer le débordement sans mesurer les largeurs :

```ts
// flex-wrap reste actif, la hauteur du conteneur est bridee a une rangee : les
// pastilles rejetees sont exactement celles dont l'offsetTop depasse celui de
// la premiere. Mesurer les largeurs une a une serait fragile — noms variables,
// panneau redimensionnable.
function hiddenFrom(row: HTMLElement): number {
  const items = [...row.children] as HTMLElement[];
  const first = items[0];
  if (!first) return items.length;

  const index = items.findIndex(
    (item) => item.offsetTop > first.offsetTop,
  );
  return index === -1 ? items.length : index;
}
```

- [ ] Un `ResizeObserver` sur le conteneur relance la mesure.
- [ ] `Tous` et `Sans étape` sont **épinglées**, jamais dans le débordement. La
      pastille **active** est toujours tirée dans la rangée visible, sinon le
      filtre ne dit plus sur quoi il filtre.
- [ ] Le déclencheur « +N » ouvre un `Popover` (`align="end"`) listant le reste
      avec ses compteurs.
- [ ] Dans `src/lib/filterIdeas.ts` : `FilterStatus` devient
      `FilterLabel = string | 'all' | 'none'`, et le filtrage compare
      `idea.labelId`. Mettre à jour `test/filterIdeas.test.ts`.
- [ ] Les compteurs restent calculés côté panneau, dans `ListScreen` — chaque
      idée porte son `labelId` et `GET /ideas` renvoie tout.
- [ ] Sans aucune étape, **pas de rangée de filtre** : `Tous` et `Sans étape`
      diraient la même chose.

| Cas                                   | Attendu                        |
| ------------------------------------- | ------------------------------ |
| `hiddenFrom` sur une rangée qui tient | la longueur de la liste        |
| `hiddenFrom` avec la 4ᵉ rejetée       | `3`                            |
| `filterIdeas` sur `'all'`             | tout                           |
| `filterIdeas` sur `'none'`            | les idées à `labelId === null` |
| `filterIdeas` sur un id               | les idées de cette étape       |

> **Limite dite plutôt que masquée** : jsdom ne calcule pas de mise en page,
> donc `offsetTop` y vaut toujours 0. Les tests ci-dessus injectent des valeurs
> et prouvent la **décision**, pas la mesure. La justesse de la mesure se
> vérifie à la main, en rétrécissant le panneau.

**Vérification**

- [ ] `pnpm build`, puis dans l'extension : créer huit étapes, rétrécir le
      panneau, et vérifier que la rangée ne passe jamais à la ligne et que « +N »
      compte juste.
- [ ] Filtrer sur une étape du débordement : sa pastille doit **remonter** dans
      la rangée visible.

---

### Tâche 13 : l'écran des étapes

**Pourquoi.** La dernière pièce, et la quatrième surface. Après elle
l'application refonctionne.

- [ ] Dans `src/routes/routes.ts` :

```ts
export type Route =
  | { screen: 'ideas'; selectedId: string | null }
  | { screen: 'labels' };
```

- [ ] `src/sidepanel/App.tsx` est le seul à mapper `Route` → écran. L'écran des
      étapes **remplace la coque** tant qu'il est ouvert.
- [ ] Créer `src/screens/LabelsScreen.tsx` : la liste, le renommage en place
      (32 caractères), l'ajout, la suppression avec sa confirmation, la poignée
      et les deux flèches.
- [ ] La confirmation **annonce le nombre** : « 3 idées n'auront plus d'étape.
      Elles ne sont pas supprimées — tu pourras les reclasser. » Le compte se
      lit dans `useIdeas`, sans appel serveur.
- [ ] La poignée est **six disques pleins en 2×3**, `touch-action: none`, avec
      une zone de préhension élargie par un `padding` compensé d'une marge
      négative.
- [ ] Les deux flèches sont désactivées aux extrémités et **gardent le focus**
      après le déplacement, sinon l'usage au clavier est impraticable.

> Les flèches ne sont pas la version économique du glissement : **WCAG 2.2,
> critère 2.5.7** exige qu'une fonction opérable par glissement le soit aussi
> sans glisser. Les deux partent ensemble.

- [ ] Le même composant sert à l'amorçage — en-tête « Commencer » — et à la
      gestion — en-tête avec une croix.

**Vérification**

- [ ] `pnpm build`, puis dans l'extension, **les huit gestes** : renommer,
      ajouter, supprimer une étape vide, supprimer une étape peuplée, monter à
      la flèche, descendre au glissement, classer depuis une carte, détacher.
- [ ] Au clavier seul, sans souris : toute la liste se réordonne.
- [ ] Au doigt (mode tactile des outils de développement) : le glissement
      répond, et les flèches sont visibles.

---

## Lot 5 — Documentation et production

### Tâche 14 : la documentation

**Pourquoi.** Les règles décrivent le monde d'avant sur cinq points. Une règle
fausse est pire qu'une règle absente.

- [ ] `.claude/rules/storage.md` : le modèle (`Label`, `Idea.labelId`), le
      repository, la section « Chiffrement au repos » étendue à `labels.name`,
      et le retrait de la mention de `src/storage/storage.ts`.
- [ ] `.claude/rules/structure.md` : les fichiers neufs
      (`store/labels.ts`, `adopt-labels.ts`, `adopt-labels-cli.ts`,
      `services/labels.ts`, `LabelsProvider`, `LabelsScreen`, `LabelPicker`,
      `LabelFilter`), la disparition de `storage.ts` et `statusLabels.ts`, et la
      navigation à quatre surfaces.
- [ ] `.claude/rules/react.md` : réécrire l'entorse « `ListScreen` lit deux
      contextes… mais il est le seul » — il en lira **trois**.
- [ ] `.claude/rules/css.md` : la palette `--label-1..8` remplace `--status-*`.
- [ ] `README.md` : `db:labels` dans les commandes.
- [ ] `README.md` : `docs/labels-design.md` dans la table de documentation.
- [ ] **`CLAUDE.md`** : retirer du hors-scope « Changement de statut : dans la
      vue détail uniquement. Pas de changement depuis l'accueil ni la liste. »
      — **acté par le PO.** Corriger aussi, dans la pile, « `chrome.storage.local`
      ne sert plus qu'à la reprise des idées d'avant la bascule » : `storage.ts`
      n'existe plus.
- [ ] `docs/labels-design.md` : acter les quatre points ouverts, et sortir
      l'écran d'amorçage de la Definition of Done.

**Vérification**

- [ ] `pnpm format` et `pnpm lint` verts.
- [ ] Relire `storage.md` en se demandant : quelqu'un qui ne connaît pas cette
      brique peut-il écrire un nouveau chemin d'écriture sans oublier de
      chiffrer ?

---

### Tâche 15 : la production — **PO**

**Pourquoi.** Même prudence que la tâche 7 du plan sécurité, et la même règle :
ce qui n'est pas réversible passe en dernier.

#### A. Avant de toucher à la machine

- [ ] Sur ta machine, compter ce qui existe, pour comparer après :

```bash
cd /srv/idea-pipeline && docker compose exec -T db \
  psql -U idea -d idea_pipeline -c \
  "SELECT count(*) AS comptes FROM users;
   SELECT status, count(*) FROM ideas GROUP BY status ORDER BY status;"
```

Note les nombres. Tu les vérifieras à l'étape D.

#### B. Arrêter, puis sauvegarder sans rien écrire en clair sur le VPS

- [ ] Arrêter l'API, pour qu'aucune écriture n'arrive pendant la conversion :

```bash
sudo systemctl stop idea-pipeline
```

- [ ] Sauvegarder **chez toi**, en faisant transiter le flux par ssh :

```bash
ssh <ton-vps> "cd /srv/idea-pipeline && docker compose exec -T db \
  pg_dump -U idea idea_pipeline" > avant-etapes.sql
```

> Rien n'est écrit sur le disque du VPS, où la sauvegarde d'OVH pourrait le
> capturer. Les notes de ce fichier sont chiffrées — mais les `status`, eux,
> sont en clair, et c'est justement ce qu'on s'apprête à convertir.

#### C. Déployer le code, puis migrer, puis convertir

**Le déploiement vient en premier, et ce n'est pas un détail d'ordre.**
`db:labels` est un script du code neuf : sur une machine qui tourne encore
l'ancien, la commande n'existe pas. Pousser les commits avant de monter sur le
VPS.

```bash
cd /srv/idea-pipeline
git pull
pnpm install && pnpm --dir server install
pnpm --dir server db:migrate   # applique 003
pnpm --dir server db:types     # après la migration, jamais avant
pnpm --dir server build
```

> **On ne redémarre pas ici.** L'API reste arrêtée depuis B jusqu'à la fin de la
> conversion : une écriture qui arriverait entre la migration et `db:labels`
> naîtrait sans étape, dans une base à moitié convertie. C'est l'étape D qui la
> relance.

- [ ] `003_labels.sql` apparaît dans `schema_migrations` — la table s'appelle
      ainsi, pas `migrations`. Lire les **noms** plutôt que les compter : un
      total ne dit pas laquelle a été appliquée.

```bash
docker compose exec -T db psql -U idea -d idea_pipeline \
  -c 'SELECT name FROM schema_migrations ORDER BY name;'
```

Puis, et seulement là, la conversion :

```bash
cd /srv/idea-pipeline/server && pnpm run db:labels
```

- [ ] Le nombre de comptes traités doit **égaler** le nombre noté en A, et le
      nombre de liens créés doit égaler le nombre d'idées — chaque idée portait
      un `status`, donc chacune reçoit une étape.

> **La colonne `status` n'est pas supprimée ici.** `004` n'existe pas encore :
> elle est écrite à la tâche 16, une fois la production convertie. Tant qu'elle
> n'est pas passée, la conversion se rejoue autant de fois qu'il le faut.

#### D. Vérifier avant de reprendre le service

- [ ] Relancer `db:labels` : il doit annoncer `Déjà pourvus` pour tous les
      comptes et ne créer aucun lien. C'est la preuve que la conversion est
      complète, pas seulement qu'elle a tourné.
- [ ] Redémarrer l'API et vérifier qu'elle tient debout :

```bash
sudo systemctl start idea-pipeline && sudo systemctl status idea-pipeline --no-pager
```

- [ ] Recharger l'extension et vérifier que **les idées d'avant portent toujours
      leur étape**, avec les bons libellés. Contrairement à la brique sécurité,
      l'extension **doit** être reconstruite et rechargée : le front a changé.

#### E. Seulement maintenant

- [ ] Détruire le `pg_dump` local.

---

## Ce que ce plan ne fait pas

- **Il ne construit pas le second axe** — des étiquettes multiples par sujet. Le
  schéma en est capable, le produit n'y invite pas.
- Il n'ajoute **pas** de catégories fixes à la Linear/Notion.
- Il ne permet **pas** de compter les idées par étape côté serveur : le
  chiffrement des noms ferme cette porte.
- Il n'ajoute **pas** de glisser-déposer d'une idée vers une étape depuis la
  liste. On classe par le menu.
- Il ne laisse **aucun** choix de couleur à l'utilisateur.

## Notes / Blocage

- **Les quatre points de surface sont tranchés** (voir la conception). Le seul
  qui emporte du travail : **l'amorçage sort de la brique** et fera l'objet
  d'une brique à part, déclenchée **après la première capture**.
- **`CLAUDE.md` a été acté par le PO** : la ligne « Changement de statut : dans
  la vue détail uniquement » est retirée du hors-scope.
- **Le message « Le nom de l'étape est trop long. » est nouveau au contrat.**
  S'il ne te convient pas, c'est le moment — il part dans `api-design.md` à la
  tâche 4 et devient la référence.
- **`pnpm typecheck` ne verra pas la fenêtre cassée** entre les tâches 6 et 13.
  C'est une frontière d'exécution, pas de compilation. Ne déploie pas dedans.
- L'unicité des noms ne peut pas être une contrainte SQL : deux créations
  simultanées du même nom passeraient toutes les deux. Négligeable sur un compte
  piloté depuis un panneau, mais pas nul.

## Messages de commit proposés

Un par lot, pour que chaque étage soit isolable si un retour arrière s'impose.

```
feat(store): add per-account pipeline stages

Two tables: the stages themselves, and a join table whose primary key
already allows several per idea. A single named constraint says "one
for now", so opening it later drops one line and touches no data.

Stage names are user content and are sealed like notes, with the
account id as the signature.
```

```
feat(api): expose stages and let an idea carry one

PATCH /ideas/{id} now takes a labelId, where null detaches. Reordering
is a collection-level PATCH carrying the whole ordered list: a per-item
position would need N calls whose interleaving produces incoherent
orders.

Duplicate names are refused in the service, not in SQL — every seal
uses a fresh IV, so an index would never see them.
```

```
chore(server): adopt the four historical stages per account

Idempotent: an account that already has stages is skipped. Runs before
the column it reads is dropped, and nothing but that column is read in
plaintext.
```

```
feat(panel): classify ideas from the card

The card stops being a button so the picker can sit beside the opening
target rather than inside it, which browsers repair by closing the
outer button early.

The filter keeps to one row and announces what it hides, instead of
letting a hidden scrollbar take stages off screen.
```

```
docs: record configurable stages across the rules
```

### Tâche 16 : supprimer la colonne — **en tout dernier**

**Pourquoi si tard.** `adopt-labels.ts` lit `ideas.status` en SQL brut, ce qui
le met à l'abri de la **compilation** — mais pas de l'**exécution**. Le conteneur
de test rejoue toutes les migrations : le jour où celle-ci existe, la reprise et
ses tests meurent.

Or la production a besoin du script (tâche 15). Le supprimer avant qu'elle l'ait
lancé obligerait à **deux déploiements**. Cette tâche passe donc après tout le
reste, production comprise.

En attendant, la colonne reste là sans gêner : plus personne ne la lit, et les
idées neuves y reçoivent `captured` en silence.

- [ ] Créer `server/migrations/004_drop_status.sql` :

```sql
ALTER TABLE ideas DROP CONSTRAINT ideas_status_check;
ALTER TABLE ideas DROP COLUMN status;
```

**Vérification**

```bash
cd server && pnpm run db:migrate && pnpm run db:types
```

- [ ] `schema.generated.ts` n'a plus `status` sur `ideas`.
- [ ] `pnpm test` vert · `pnpm --dir server typecheck` vert.

---

- [ ] Supprimer `server/src/store/adopt-labels.ts`, `adopt-labels-cli.ts`,
      `adopt-labels.test.ts` et le script `db:labels`. Le travail est fait, et
      un script qui ne peut plus tourner est du code mort.

**Vérification**

- [ ] `pnpm test` vert · `pnpm --dir server typecheck` vert.
- [ ] `grep -rn "status" server/src/` ne rend plus que des codes HTTP.

---
