# Titre d'une idée — plan d'implémentation

> Huit tâches, dans l'ordre. Chacune se termine par une suite verte et un
> message de commit. On n'entame pas la suivante avant que la précédente soit
> commitée.

**But :** une idée porte un titre nullable, posé depuis le volet détail, scellé
en base, cherché comme le texte.

**Approche :** le contrat d'abord, puis la base, puis le serveur, puis le
trajet panneau ↔ worker, puis l'écran. Les quatre premières tâches ne changent
rien à ce que voit l'utilisateur.

**Pile :** rien de neuf. Express 5, Kysely, Zod, React, `vitest`.

**Conception :** `docs/title-design.md` — le plan argumente depuis elle. Lire
les deux.

## Contraintes globales

- **TypeScript strict.** Le code livré passe `pnpm lint`, `pnpm format` et
  `pnpm typecheck` sans erreur.
- **Anglais dans le code**, français réservé à l'interface et aux messages
  d'erreur de l'API, repris **mot pour mot** du contrat.
- **Aucune dépendance nouvelle.** Aucune commande `pnpm add`.
- **Git est manuel.** Les blocs « commit » de ce plan sont des **textes
  proposés** ; c'est le PO qui commite.
- **Docker doit tourner** pour la suite serveur : `docker compose up -d --wait`.
- **Commentaires** : uniquement piège d'API, contrainte externe, avertissement
  local. Le pourquoi vit dans `title-design.md`, jamais dans le code.

**Les commandes, une fois pour toutes :**

| Quoi                      | Commande                                    |
| ------------------------- | ------------------------------------------- |
| Suite serveur, un fichier | `pnpm vitest run --project server <filtre>` |
| Suite front, un fichier   | `pnpm vitest run --project front <filtre>`  |
| Un seul test              | ajouter `-t "<nom du test>"`                |
| Tout                      | `pnpm test`                                 |
| Types                     | `pnpm typecheck`                            |

**Un piège de découpage, à connaître avant de commencer.**
`server/src/routes/contract.test.ts` compare les routes montées et les chemins
du spec **par égalité stricte, dans les deux sens**. Un chemin déclaré sans
route échoue ; une route sans chemin échoue. `/ideas/{id}/title` et
`ideasRouter.patch('/:id/title')` sont donc dans la **même tâche** — la 4.

---

## Tâche 1 : la colonne

Une migration seule. Personne ne lit la colonne encore, donc tout reste vert.

**Fichiers :**

- Créer : `server/migrations/005_title.sql`
- Régénérer : `server/src/store/schema.generated.ts` (non versionné)

- [x] **Étape 1 : écrire la migration**

`server/migrations/005_title.sql` :

```sql
-- Scellée par store/notes.ts, contexte = l'id de l'idée. Ne jamais indexer :
-- chaque scellement utilise un IV neuf, donc deux titres identiques écrivent
-- deux valeurs différentes et l'index ne verrait rien.
ALTER TABLE ideas ADD COLUMN title text;
```

- [x] **Étape 2 : l'appliquer**

```bash
docker compose up -d --wait
pnpm --dir server db:migrate
```

Attendu : la migration `005_title` est appliquée.

- [x] **Étape 3 : régénérer les types de la base**

```bash
pnpm --dir server db:types
```

Attendu : `server/src/store/schema.generated.ts` contient `title: string | null`
dans l'interface `Ideas`. Vérifier :

```bash
grep -n "title" server/src/store/schema.generated.ts
```

- [x] **Étape 4 : vérifier que rien n'a bougé**

```bash
pnpm typecheck
pnpm vitest run --project server
```

Attendu : tout passe. La colonne existe, personne ne la lit.

- [x] **Étape 5 : commit**

```
feat(db): give an idea a column for its title

Nullable and sealed like the notes; nothing reads it yet.
```

---

## Tâche 2 : le titre dans le contrat, lu jusqu'au bout

Le champ entre dans `openapi.yaml`, les types générés le portent, et
`toIdea` l'ouvre. Toujours aucune écriture.

**Fichiers :**

- Modifier : `docs/openapi.yaml` — schéma `Idea`
- Régénérer : `server/src/domain/api.generated.ts` (non versionné)
- Modifier : `server/src/store/ideas.ts` — `toIdea`
- Modifier : `server/src/store/ideas.test.ts`

**Interfaces produites :** `Idea.title: string | null` — requis, jamais
`undefined`. Toutes les tâches suivantes en dépendent.

- [x] **Étape 1 : écrire le test qui échoue**

Dans `server/src/store/ideas.test.ts`, à la fin du bloc
`describe('createIdea', …)` :

```ts
it('is born without a title', async () => {
  const idea = await store.createIdea(userId, 'une idée');

  expect(idea.title).toBeNull();
});
```

- [x] **Étape 2 : le lancer, vérifier qu'il échoue**

```bash
pnpm vitest run --project server ideas -t "is born without a title"
```

Attendu : ÉCHEC — `title` n'existe pas sur `Idea` (erreur de type, puis
`undefined` au lieu de `null`).

- [x] **Étape 3 : déclarer le champ dans le contrat**

Dans `docs/openapi.yaml`, schéma `Idea` : ajouter `- title` à la liste
`required`, **après** `- labelId`, puis la propriété, **après** `labelId` :

```yaml
title:
  type: string
  nullable: true
  description: |
    Le titre de l'idée, ou `null`. Il n'est **jamais** demandé à la
    capture : une idée naît sans titre et peut le rester. Toujours
    présent, jamais absent — le front lit `null`, pas `undefined`.
    Voir `docs/title-design.md`.
```

- [x] **Étape 4 : régénérer les types de l'API**

```bash
pnpm --dir server generate:types
```

- [x] **Étape 5 : ouvrir le titre à la lecture**

Dans `server/src/store/ideas.ts`, `toIdea` — une ligne, après `labelId` :

```ts
const toIdea = (
  row: IdeaRow,
  variations: VariationRow[],
  labelId: string | null,
): Idea => ({
  id: row.id,
  labelId,
  title: row.title === null ? null : open(row.title, row.id),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  variations: variations.map(toVariation),
});
```

C'est le **seul** endroit à toucher : les quatre fonctions du store construisent
toutes leur `Idea` par ici.

- [x] **Étape 6 : relancer, vérifier que ça passe**

```bash
pnpm vitest run --project server ideas
pnpm vitest run --project server types
pnpm typecheck
```

Attendu : vert partout. `domain/types.test.ts` régénère le fichier dans un
dossier temporaire et le compare — il échoue si l'étape 4 a été oubliée.

- [x] **Étape 7 : commit**

```
feat(api): carry an idea's title through the contract

The Idea schema gains a nullable title and the store opens it on the
way out. Nothing writes one yet.
```

---

## Tâche 3 : `setTitle` dans le store

**Fichiers :**

- Modifier : `server/src/store/ideas.ts`
- Modifier : `server/src/store/ideas.test.ts`
- Modifier : `server/src/store/sealed-at-rest.test.ts`

**Interfaces produites :**

```ts
setTitle(userId: string, id: string, title: string | null): Promise<Idea | null>
```

`null` en retour = idée introuvable ou d'un autre compte, exactement comme
`setLabel`.

- [x] **Étape 1 : écrire les tests qui échouent**

Dans `server/src/store/ideas.test.ts`, un bloc nouveau à la fin :

```ts
describe('setTitle', () => {
  it('writes a title and hands the idea back', async () => {
    const created = await store.createIdea(userId, 'une idée');

    const idea = await store.setTitle(
      userId,
      created.id,
      'Le vrai coût du no-code',
    );

    expect(idea?.title).toBe('Le vrai coût du no-code');
  });

  it('survives a reread', async () => {
    const created = await store.createIdea(userId, 'une idée');
    await store.setTitle(userId, created.id, 'Un titre');

    const [idea] = await store.listIdeas(userId);

    expect(idea?.title).toBe('Un titre');
  });

  it('removes the title when given null', async () => {
    const created = await store.createIdea(userId, 'une idée');
    await store.setTitle(userId, created.id, 'Un titre');

    const idea = await store.setTitle(userId, created.id, null);

    expect(idea?.title).toBeNull();
  });

  it('leaves the variations alone', async () => {
    const created = await store.createIdea(userId, 'une idée');

    const idea = await store.setTitle(userId, created.id, 'Un titre');

    expect(idea?.variations).toHaveLength(1);
    expect(idea?.variations[0]?.text).toBe('une idée');
  });

  it('touches updated_at', async () => {
    const created = await store.createIdea(userId, 'une idée');
    await backdate(created.id, '2026-01-01T00:00:00.000Z');

    const idea = await store.setTitle(userId, created.id, 'Un titre');

    expect(idea?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('refuses an idea that belongs to another account', async () => {
    const created = await store.createIdea(userId, 'une idée');
    const { userId: other } = await createUserWithSession();

    expect(
      await store.setTitle(other, created.id, 'Un titre'),
    ).toBeNull();
  });

  it('answers null on an id that is not a uuid', async () => {
    expect(
      await store.setTitle(userId, 'pas-un-uuid', 'x'),
    ).toBeNull();
  });
});
```

- [x] **Étape 2 : les lancer, vérifier qu'ils échouent**

```bash
pnpm vitest run --project server ideas -t "setTitle"
```

Attendu : ÉCHEC — `store.setTitle` n'existe pas.

- [x] **Étape 3 : écrire `setTitle`**

Dans `server/src/store/ideas.ts`, après `setLabel` :

```ts
export async function setTitle(
  userId: string,
  id: string,
  title: string | null,
): Promise<Idea | null> {
  if (!isUuid(id)) return null;

  return db()
    .transaction()
    .execute(async (trx) => {
      const idea = await trx
        .updateTable('ideas')
        .set({
          title: title === null ? null : seal(title, id),
          updated_at: touch(),
        })
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirst();

      if (!idea) return null;

      const variations = await trx
        .selectFrom('variations')
        .selectAll()
        .where('idea_id', '=', id)
        .orderBy('position')
        .execute();

      return toIdea(idea, variations, await labelOf(trx, id));
    });
}
```

- [x] **Étape 4 : relancer, vérifier que ça passe**

```bash
pnpm vitest run --project server ideas
```

- [x] **Étape 5 : prouver que rien n'atteint la base en clair**

Ce fichier interroge Postgres en **SQL brut**, jamais par le store : passer
par le store appellerait `toIdea`, qui déchiffre. Il lui faut donc son propre
lecteur, à côté de `stored` et `storedNames` déjà présents :

```ts
// Same reason as the two above: toIdea decrypts, so the store cannot be asked
// what the column holds.
const storedTitle = async (
  ideaId: string,
): Promise<string | null> => {
  const result = await sql<{ title: string | null }>`
    SELECT title FROM ideas WHERE id = ${ideaId}
  `.execute(db());

  return result.rows[0]?.title ?? null;
};
```

Puis un `describe` nouveau, après celui des noms d'étape, qui réutilise le
`MARKER` du fichier :

```ts
describe("what the database holds of an idea's title", () => {
  it('not the title itself', async () => {
    const idea = await store.createIdea(userId, 'une idée');

    await store.setTitle(userId, idea.id, MARKER);

    const title = await storedTitle(idea.id);
    expect(title).toMatch(/^v1\./);
    expect(title).not.toContain(MARKER);
  });

  it('and gives it back intact', async () => {
    const idea = await store.createIdea(userId, 'une idée');

    await store.setTitle(userId, idea.id, MARKER);

    const [reread] = await store.listIdeas(userId);
    expect(reread?.title).toBe(MARKER);
  });

  it('nothing at all while the idea has no title', async () => {
    const idea = await store.createIdea(userId, 'une idée');

    expect(await storedTitle(idea.id)).toBeNull();
  });
});
```

- [x] **Étape 6 : relancer**

```bash
pnpm vitest run --project server sealed-at-rest
pnpm typecheck
```

- [x] **Étape 7 : remettre la règle de stockage d'aplomb**

`.claude/rules/storage.md` dit ce que la base ne contient jamais en clair.
Deux phrases deviennent fausses ici.

Section « Chiffrement au repos », première phrase — `ideas.title` rejoint les
deux autres colonnes scellées :

> `variations.text`, `labels.name` et `ideas.title` **ne contiennent jamais de
> texte lisible**.

Et la phrase qui clôt la section, sur le contexte mêlé à la signature :

> Un identifiant est mêlé à la signature : celui de l'idée pour une variation
> **et pour son titre**, celui du compte pour une étape. Une ligne recopiée
> ailleurs ne s'ouvre plus.

Laisser cette règle décrire un stockage périmé, c'est travailler demain sur une
carte fausse — elle est chargée à chaque session.

- [x] **Étape 8 : commit**

```
feat(db): write and clear an idea's title

Sealed with the idea's own id as context, so a title copied onto
another row no longer opens.
```

---

## Tâche 4 : le service, la route, et le chemin du contrat

Les trois ensemble : `contract.test.ts` refuse un chemin sans route et une
route sans chemin.

**Fichiers :**

- Modifier : `docs/openapi.yaml` — le chemin et le schéma de requête
- Modifier : `server/src/services/ideas.ts`
- Modifier : `server/src/controllers/ideas.ts`
- Modifier : `server/src/routes/ideas.ts`
- Modifier : `server/src/services/ideas.test.ts`
- Modifier : `server/src/isolation.test.ts`

**Interfaces produites :**

```ts
setIdeaTitle(userId: string, ideaId: string, body: unknown): Promise<Idea>
```

- [x] **Étape 1 : écrire les tests de validation qui échouent**

Dans `server/src/services/ideas.test.ts`, à la fin :

```ts
const REQUIRED_TITLE = {
  status: 400,
  message: 'Le champ "title" est obligatoire.',
};

describe('setIdeaTitle validation', () => {
  let ideaId: string;

  beforeEach(async () => {
    const idea = await service.createIdea(userId, {
      text: 'une idée',
    });
    ideaId = idea.id;
  });

  it('rejects an absent body', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, undefined),
    ).rejects.toMatchObject(REQUIRED_TITLE);
  });

  it('rejects a missing title', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, {}),
    ).rejects.toMatchObject(REQUIRED_TITLE);
  });

  it('rejects a title that is not a string or null', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, { title: 7 }),
    ).rejects.toMatchObject(REQUIRED_TITLE);
  });

  it('rejects a title beyond 80 characters', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, { title: 'a'.repeat(81) }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Le titre est trop long.',
    });
  });

  it('rejects a field outside the schema', async () => {
    await expect(
      service.setIdeaTitle(userId, ideaId, { title: 'x', color: 1 }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Champs non autorisés.',
    });
  });

  it('answers 404 on an idea that does not exist', async () => {
    await expect(
      service.setIdeaTitle(
        userId,
        '00000000-0000-4000-8000-000000000000',
        { title: 'x' },
      ),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Idée introuvable.',
    });
  });
});

describe('setIdeaTitle', () => {
  it('trims the stored title', async () => {
    const created = await service.createIdea(userId, {
      text: 'une idée',
    });

    const idea = await service.setIdeaTitle(userId, created.id, {
      title: '  Un titre  ',
    });

    expect(idea.title).toBe('Un titre');
  });

  it('reads null and a blank string as the same removal', async () => {
    const created = await service.createIdea(userId, {
      text: 'une idée',
    });
    await service.setIdeaTitle(userId, created.id, {
      title: 'Un titre',
    });

    const blanked = await service.setIdeaTitle(userId, created.id, {
      title: '   ',
    });
    expect(blanked.title).toBeNull();

    await service.setIdeaTitle(userId, created.id, {
      title: 'Un titre',
    });
    const nulled = await service.setIdeaTitle(userId, created.id, {
      title: null,
    });
    expect(nulled.title).toBeNull();
  });

  it('accepts a title of exactly 80 characters', async () => {
    const created = await service.createIdea(userId, {
      text: 'une idée',
    });

    const idea = await service.setIdeaTitle(userId, created.id, {
      title: 'a'.repeat(80),
    });

    expect(idea.title).toHaveLength(80);
  });
});
```

- [x] **Étape 2 : les lancer, vérifier qu'ils échouent**

```bash
pnpm vitest run --project server services/ideas
```

Attendu : ÉCHEC — `service.setIdeaTitle` n'existe pas.

- [x] **Étape 3 : écrire la validation et le service**

Dans `server/src/services/ideas.ts`, sous `LabelBody` :

```ts
const TitleBody = z.strictObject({
  title: z.string().trim().max(80).nullable(),
});
```

Sous `parseLabelBody` :

```ts
function parseTitleBody(body: unknown): string | null {
  const result = TitleBody.safeParse(body);

  if (result.success) {
    // A blank string and null are the same removal; the contract refuses to
    // have two ways of saying it.
    return result.data.title === null || result.data.title === ''
      ? null
      : result.data.title;
  }

  if (hasUnknownField(result.error)) {
    throw new ApiError(400, 'Champs non autorisés.');
  }

  if (result.error.issues.some((issue) => issue.code === 'too_big')) {
    throw new ApiError(400, 'Le titre est trop long.');
  }

  throw new ApiError(400, 'Le champ "title" est obligatoire.');
}
```

À la fin du fichier :

```ts
export async function setIdeaTitle(
  userId: string,
  ideaId: string,
  body: unknown,
): Promise<Idea> {
  return requireIdea(
    await store.setTitle(userId, ideaId, parseTitleBody(body)),
  );
}
```

- [x] **Étape 4 : le controller**

Dans `server/src/controllers/ideas.ts`, après `setLabel` :

```ts
export const setTitle: RequestHandler<IdeaParams> = async (
  req,
  res,
) => {
  res
    .status(200)
    .json(
      await ideaService.setIdeaTitle(
        userIdOf(req),
        req.params.id,
        req.body,
      ),
    );
};
```

- [x] **Étape 5 : la route**

Dans `server/src/routes/ideas.ts`, après `ideasRouter.patch('/:id', …)` :

```ts
ideasRouter.patch('/:id/title', ideasController.setTitle);
```

- [x] **Étape 6 : vérifier que le test de contrat échoue maintenant**

```bash
pnpm vitest run --project server contract
```

Attendu : ÉCHEC — `PATCH /ideas/{id}/title` est monté mais absent du spec.
C'est le test qui fait son travail.

- [x] **Étape 7 : déclarer le chemin dans le contrat**

Dans `docs/openapi.yaml`, après le bloc `/ideas/{id}:` et avant
`/ideas/{id}/variations:` :

```yaml
/ideas/{id}/title:
  parameters:
    - $ref: '#/components/parameters/IdeaId'

  patch:
    operationId: setIdeaTitle
    summary: Donne un titre à une idée, ou le retire
    description: |
      Écrit le titre de l'idée. `null` — ou une chaîne qui ne contient que
      des espaces — le retire : l'idée redevient sans titre.

      Le titre n'est jamais demandé à la capture : `POST /ideas` ne le
      connaît pas. Voir `docs/title-design.md`.
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SetIdeaTitleRequest'
    responses:
      '200':
        description: Idée mise à jour.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Idea'
      '400':
        description: |
          Requête invalide. Messages possibles :
          - `Le champ "title" est obligatoire.` — champ absent, ou d'un type autre qu'une chaîne ou `null` ; corps vide inclus.
          - `Le titre est trop long.` — plus de 80 caractères.
          - `Champs non autorisés.` — au moins un champ hors du schéma est présent.
          - `Corps de requête JSON invalide.` — JSON malformé.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
      '404':
        description: |
          `Idée introuvable.` — l'`id` ne correspond à aucune idée du compte.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
      '401':
        $ref: '#/components/responses/Unauthenticated'
      '500':
        description: |
          `Erreur inattendue côté serveur.`
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
```

Et dans `components.schemas`, à côté de `SetIdeaLabelRequest` :

```yaml
SetIdeaTitleRequest:
  type: object
  additionalProperties: false
  required:
    - title
  properties:
    title:
      type: string
      maxLength: 80
      nullable: true
      description: |
        Le titre voulu, ou `null` pour le retirer. Une chaîne qui ne
        contient que des espaces vaut `null` : il n'y a pas d'endpoint
        séparé pour effacer un titre.
```

- [x] **Étape 8 : régénérer et relancer**

```bash
pnpm --dir server generate:types
pnpm vitest run --project server contract
pnpm vitest run --project server services/ideas
```

Attendu : vert.

- [x] **Étape 9 : le cloisonnement**

Ce fichier n'appelle pas le service : il passe par **HTTP**, avec le helper
`as(token, path, init)`, et il éprouve toutes les écritures dans **une seule
boucle**. Il n'y a donc pas de test à ajouter — il y a **une entrée** à poser
dans le tableau du test « get 404 and never 403 on the ideas of the other »,
à la suite des quatre qui y sont :

```ts
      [
        'PATCH',
        `/ideas/${idea.id}/title`,
        JSON.stringify({ title: 'Un titre' }),
      ],
```

C'est tout : la boucle vérifie déjà le `404`, le corps `Idée introuvable.`, et
qu'aucun de ces appels n'a touché l'idée d'alice.

- [x] **Étape 10 : la suite serveur entière**

```bash
pnpm vitest run --project server
pnpm typecheck
pnpm lint
```

- [x] **Étape 11 : commit**

```
feat(api): add PATCH /ideas/:id/title

A second intention on the idea resource takes a path of its own, the
way reordering stages did: widening PATCH /ideas/:id would have made
its published error message false and blurred which optimistic write
to roll back.
```

---

## Tâche 5 : le trajet panneau ↔ worker

Cinq couches, aucune sautable. Rien à l'écran encore.

**Fichiers :**

- Modifier : `src/storage/types.ts`
- Modifier : `src/lib/protocol.ts`
- Modifier : `src/background/api.ts`
- Modifier : `src/background/messages.ts`
- Modifier : `src/storage/remote.ts`
- Modifier : `src/lib/optimistic.ts`
- Modifier : `test/remote.test.ts`, `test/messages.test.ts`
- Modifier : `test/optimistic.test.ts`, `test/filterIdeas.test.ts` — les
  fixtures, que le champ requis casse

**Interfaces produites :**

```ts
// src/lib/protocol.ts
{ kind: 'ideas/setTitle'; ideaId: string; title: string | null }
// src/storage/remote.ts
setTitle(ideaId: string, title: string | null): Promise<Idea>
```

- [x] **Étape 1 : écrire le test qui échoue**

Dans `test/remote.test.ts`, dans le test « names every operation the way the
worker expects », ajouter l'appel et l'attente correspondante :

```ts
await repository.setTitle('i', 'Un titre');
```

et, dans le tableau attendu, à sa place dans l'ordre des appels :

```ts
      { kind: 'ideas/setTitle', ideaId: 'i', title: 'Un titre' },
```

- [x] **Étape 2 : le lancer, vérifier qu'il échoue**

```bash
pnpm vitest run --project front remote
```

Attendu : ÉCHEC — `setTitle` n'existe pas sur le dépôt.

- [x] **Étape 3 : le type**

Dans `src/storage/types.ts`, interface `Idea`, après `labelId` :

```ts
title: string | null;
```

- [x] **Étape 4 : réparer les trois constructions littérales**

Le champ est requis : `pnpm typecheck` nomme exactement les endroits. Il y en a
**quatre** — un relevé fait au `grep` n'en avait trouvé que trois, parce que le
quatrième construit son `Idea` dans une fonction fléchée. C'est `typecheck` qui
fait foi, pas la liste ci-dessous.

`src/lib/optimistic.ts`, `provisionalIdea` :

```ts
return {
  id,
  labelId: null,
  title: null,
  createdAt: now,
  updatedAt: now,
  variations: [{ id: `${id}-v1`, text, createdAt: now }],
};
```

`test/optimistic.test.ts`, la fixture `existing` : ajouter `title: null,`
après `labelId`.

`test/variations.test.ts`, la fabrique `ideaWith` : ajouter `title: null,`
après `labelId`.

`test/filterIdeas.test.ts`, `makeIdea` : ajouter un paramètre optionnel, parce
que la tâche 8 en aura besoin —

```ts
function makeIdea(
  id: string,
  labelId: string | null,
  texts: string[] = [id],
  title: string | null = null,
): Idea {
```

et `title,` dans l'objet retourné.

- [x] **Étape 5 : le protocole**

Dans `src/lib/protocol.ts`, dans l'union `Request`, après `ideas/setLabel` :

```ts
  | { kind: 'ideas/setTitle'; ideaId: string; title: string | null }
```

et dans `ReplyData`, après `'ideas/setLabel'` :

```ts
  'ideas/setTitle': Idea;
```

- [x] **Étape 6 : l'appel HTTP**

Dans `src/background/api.ts`, après `setIdeaLabel` :

```ts
export const setIdeaTitle = (
  token: string,
  ideaId: string,
  title: string | null,
) =>
  call<Idea>(token, `/ideas/${ideaId}/title`, {
    method: 'PATCH',
    body: { title },
  });
```

- [x] **Étape 7 : le routage du worker**

Dans `src/background/messages.ts`, après le cas `'ideas/setLabel'` :

```ts
    case 'ideas/setTitle':
      return withToken((token) =>
        api.setIdeaTitle(token, request.ideaId, request.title),
      );
```

- [x] **Étape 8 : le dépôt du panneau**

Dans `src/storage/remote.ts`, dans l'interface `IdeaRepository`, après
`setLabel` :

```ts
  setTitle(ideaId: string, title: string | null): Promise<Idea>; // null clears it
```

et dans `MessagingIdeaRepository` :

```ts
  async setTitle(
    ideaId: string,
    title: string | null,
  ): Promise<Idea> {
    return ask({ kind: 'ideas/setTitle', ideaId, title });
  }
```

- [x] **Étape 9 : couvrir le worker**

Le test « route each kind to its own operation » appelle chaque message puis
compare la liste des `MÉTHODE chemin` réellement atteints. Deux ajouts, et ils
doivent rester **à la même place dans les deux listes** — c'est un tableau
ordonné.

Après le `handle` de `ideas/setLabel` :

```ts
await handle({
  kind: 'ideas/setTitle',
  ideaId: 'i',
  title: 'Un titre',
});
```

et, dans le tableau attendu, juste après `'PATCH /ideas/i'` :

```ts
      'PATCH /ideas/i/title',
```

Une branche mal câblée répondrait `ok` sur le mauvais endpoint : c'est
exactement ce que cette liste attrape.

- [x] **Étape 10 : relancer**

```bash
pnpm vitest run --project front
pnpm typecheck
```

Attendu : vert.

- [x] **Étape 11 : remettre le modèle de la règle d'aplomb**

Toujours `.claude/rules/storage.md`, section « Modèle » : l'interface `Idea`
gagne son champ, **après `labelId`** —

```typescript
title: string | null; // null = sans titre ; jamais demandé à la capture
```

et l'interface `IdeaRepository` de la section « Repository » gagne sa méthode,
après `setLabel` —

```typescript
  setTitle(ideaId: string, title: string | null): Promise<Idea>; // null retire
```

- [x] **Étape 12 : commit**

```
feat(panel): carry setTitle from the panel to the API

The panel still makes no network call: the request crosses the same
five layers setLabel already crossed, and the worker keeps the token.
```

---

## Tâche 6 : l'affichage

Les titres se voient. Personne ne peut encore en poser : pour vérifier à
l'écran, en écrire un à la main contre l'API locale (étape 6).

**Fichiers :**

- Modifier : `src/components/IdeaCard/IdeaCard.tsx`
- Modifier : `src/components/IdeaCard/IdeaCard.module.css`
- Créer : `src/components/IdeaTitle/IdeaTitle.tsx`
- Créer : `src/components/IdeaTitle/IdeaTitle.module.css`
- Modifier : `src/screens/DetailScreen.tsx`

- [x] **Étape 1 : la carte**

Dans `src/components/IdeaCard/IdeaCard.tsx`, dans le bouton d'ouverture :

```tsx
<button type="button" className={styles.open} onClick={onClick}>
  {idea.title !== null && (
    <span className={styles.title}>{idea.title}</span>
  )}
  <span
    className={[
      styles.text,
      idea.title !== null ? styles.secondary : '',
    ].join(' ')}
  >
    {text}
  </span>
</button>
```

- [x] **Étape 2 : son style**

Dans `src/components/IdeaCard/IdeaCard.module.css`, après `.text` :

```css
/* One line, cut rather than wrapped: the extract below already carries the
 * detail, and a title on three lines would push it out of the card. */
.title {
  display: block;
  margin-bottom: 2px;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-body);
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The extract steps back when a title leads it: two blocks of equal weight
 * would compete for the same glance. */
.secondary {
  color: var(--muted);
}
```

- [x] **Étape 3 : la ligne de titre du détail, en lecture seule**

`src/components/IdeaTitle/IdeaTitle.tsx` :

```tsx
import styles from './IdeaTitle.module.css';

interface Props {
  title: string | null;
}

export default function IdeaTitle({ title }: Props) {
  if (title === null) return null;

  return <p className={styles.line}>{title}</p>;
}
```

`src/components/IdeaTitle/IdeaTitle.module.css` :

```css
/* Same size as the body text: the weight is what separates them, so the type
 * scale keeps its five tokens. */
.line {
  margin: 0 0 var(--space-1);
  max-width: 58ch;
  font-size: var(--text-hero);
  font-weight: 700;
  line-height: 1.35;
  color: var(--ink);
  overflow-wrap: anywhere;
}
```

- [x] **Étape 4 : la poser en tête du corps**

Dans `src/screens/DetailScreen.tsx`, importer le composant et le placer
**avant** `<LabelPicker …>` dans la branche `idea` :

```tsx
<IdeaTitle title={idea.title} />
```

- [x] **Étape 5 : vérifier**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

- [ ] **Étape 6 : le voir à l'écran**

Le serveur local tourne (`pnpm --dir server dev`), l'extension est chargée.
Poser un titre à la main sur une idée existante, puis rouvrir le panneau :

```bash
curl -X PATCH http://localhost:3000/ideas/<ID>/title \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <JETON>' \
  -d '{"title":"Le vrai coût du no-code"}'
```

Attendu : le titre en gras en tête du détail, et sur la carte au-dessus d'un
extrait devenu gris.

- [x] **Étape 7 : commit**

```
feat(panel): show the title an idea carries

On the card it leads the extract, which steps back to muted; in the
detail pane it opens the body. Nothing can set one yet.
```

---

## Tâche 7 : l'édition en place et l'affichage optimiste

La première fois qu'on peut titrer une idée.

**Fichiers :**

- Modifier : `src/components/IdeaTitle/IdeaTitle.tsx` — il devient interactif
- Modifier : `src/components/IdeaTitle/IdeaTitle.module.css`
- Modifier : `src/hooks/useIdeas.ts`
- Modifier : `src/hooks/IdeasProvider.tsx`
- Modifier : `src/screens/DetailScreen.tsx`

**Interfaces produites :**

```ts
// useIdeas()
setTitle: (ideaId: string, title: string | null) => Promise<Idea>;
```

- [x] **Étape 1 : la signature du contexte**

Dans `src/hooks/useIdeas.ts`, dans `IdeasContextValue`, après `setLabel` :

```ts
setTitle: (ideaId: string, title: string | null) => Promise<Idea>;
```

- [x] **Étape 2 : l'écriture optimiste**

Dans `src/hooks/IdeasProvider.tsx`, après `setLabel`, la même forme :

```tsx
const setTitle = useCallback(
  (ideaId: string, title: string | null) =>
    attempt(async () => {
      const before = state.ideas.find((item) => item.id === ideaId);

      onIdeas((ideas) =>
        ideas.map((item) =>
          item.id === ideaId ? { ...item, title } : item,
        ),
      );

      try {
        const idea = await ideaRepository.setTitle(ideaId, title);
        replace(idea);
        return idea;
      } catch (error) {
        if (before) replace(before);
        throw error;
      }
    }),
  [attempt, replace, onIdeas, state.ideas],
);
```

Puis l'ajouter aux **deux** listes de la valeur du contexte, à côté de
`setLabel` — l'objet passé au provider et son tableau de dépendances.

- [x] **Étape 3 : le composant interactif**

> **Réécrit après l'audit d'ergonomie.** Le bloc ci-dessous est le fichier
> tel qu'il est livré, pas le premier jet : le PO a retenu le champ **nu**
> (pas de boîte, un filet de 2 px porte le focus), l'aide à **hauteur
> réservée** et **aucun compteur**. Les options écartées restent jouables
> dans `design/mockup-title-audit.html`.

`src/components/IdeaTitle/IdeaTitle.tsx` :

```tsx
import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import styles from './IdeaTitle.module.css';

const MAX = 80;
const EMPTY = 'Ajouter un titre';
const HINT = '⏎ pour enregistrer · Échap pour annuler';

interface Props {
  title: string | null;
  // Rejects when the write failed; what stays on screen is then the title the
  // provider put back.
  onChange: (title: string | null) => Promise<unknown>;
}

export default function IdeaTitle({ title, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape unmounts the input, and removing a focused node fires blur: without
  // this latch, cancelling would save on the way out.
  const closing = useRef(false);

  useLayoutEffect(() => {
    if (!editing) return;
    closing.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const close = (commit: boolean) => {
    if (closing.current) return;
    closing.current = true;

    const typed = inputRef.current?.value.trim() ?? '';
    setEditing(false);

    if (!commit) return;

    const next = typed === '' ? null : typed;
    if (next !== title) void onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // A one-line field has no line break to offer, so Enter validates here
    // while it goes to a new line in the textareas — see
    // docs/writing-keys-design.md.
    if (event.key === 'Enter') {
      event.preventDefault();
      close(true);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close(false);
    }
  };

  return (
    <>
      {editing ? (
        <input
          ref={inputRef}
          className={styles.input}
          defaultValue={title ?? ''}
          placeholder={EMPTY}
          maxLength={MAX}
          aria-label="Titre de l'idée"
          onKeyDown={handleKeyDown}
          onBlur={() => close(true)}
        />
      ) : (
        <button
          type="button"
          className={[
            styles.line,
            title === null ? styles.empty : '',
          ].join(' ')}
          onClick={() => setEditing(true)}
        >
          {title ?? EMPTY}
        </button>
      )}

      {/* Always rendered, hidden at rest rather than removed: mounting it only
          while editing moved the stage, the text and Reformuler down on every
          single click. */}
      <p
        className={[styles.hint, editing ? '' : styles.silent].join(
          ' ',
        )}
      >
        {HINT}
      </p>
    </>
  );
}
```

- [x] **Étape 4 : son style**

`src/components/IdeaTitle/IdeaTitle.module.css` :

```css
/* Read and edit share their padding and their type, so the title sits at the
 * very same place in both — clicking it moves no pixel, horizontally or
 * vertically. Change one, change the other. */

/* The line is there even when empty. With no visible sign an in-place editor
 * does not exist — the grey placeholder is the whole affordance. */
.line {
  display: block;
  width: 100%;
  max-width: 58ch;
  margin: 0;
  border: none;
  background: none;
  padding: var(--space-1) 0;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--text-hero);
  font-weight: 700;
  line-height: 1.35;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: text;
}

/* A rule underneath, not a filled background: with no horizontal padding to
 * bleed into, a fill would hug the glyphs and read as a selection. */
.line:hover {
  box-shadow: inset 0 -1px 0 var(--capbd);
}

.line:focus-visible {
  outline: var(--focus-outline);
  outline-offset: var(--focus-offset);
}

/* After .line, never before: same specificity, so source order is what decides
 * which colour and weight win on an element carrying both.
 * --muted, never --faint: --faint carries no text (css.md). */
.empty {
  color: var(--muted);
  font-weight: 400;
}

/* Deliberate exception to css.md's "every focusable element carries a ring":
 * a bordered box cannot align its text with the read line without indenting
 * the title away from its own body. The 2px --accent rule is the focus
 * indicator instead — 4.02:1 on --surface, past the 3:1 WCAG 2.2 asks of a
 * non-text cue. Do not add an outline on top: the two would stack. */
.input {
  display: block;
  width: 100%;
  max-width: 58ch;
  margin: 0;
  border: none;
  outline: none;
  background: transparent;
  box-shadow: inset 0 -2px 0 var(--accent);
  padding: var(--space-1) 0;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--text-hero);
  font-weight: 700;
  line-height: 1.35;
}

/* Same words as the line it replaces: clicking "Ajouter un titre" should not
 * land on a field that has stopped saying so. */
.input::placeholder {
  color: var(--muted);
  font-weight: 400;
}

/* Its height is held at rest, never removed from the flow: showing it only
 * while editing moved everything below it on every click. */
.hint {
  margin: 0 0 var(--space-3);
  min-height: 15px;
  color: var(--muted);
  font-size: var(--text-xs);
}

.silent {
  visibility: hidden;
}
```

- [x] **Étape 5 : brancher l'écran, et régler le rythme**

`src/screens/DetailScreen.module.css` : `.reformulate` passe de `--space-4` à
`--space-5`. Le volet ne tient plus que deux écarts — `--space-3` entre blocs
voisins, `--space-5` là où la nature du bloc change.

Dans `src/screens/DetailScreen.tsx` : tirer `setTitle` de `useIdeas()`, et
passer la fonction au composant.

```tsx
<IdeaTitle
  title={idea.title}
  onChange={(next) => setTitle(idea.id, next)}
/>
```

- [x] **Étape 6 : vérifier**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

- [ ] **Étape 7 : l'essayer, réseau coupé compris**

1. Cliquer la ligne grise, taper un titre, `⏎` → il s'affiche en gras, et la
   carte de la liste le prend aussitôt.
2. Recliquer, `Échap` → le titre d'avant est toujours là, **rien n'a été
   enregistré**.
3. Recliquer, tout effacer, `⏎` → la ligne grise revient.
4. **Couper le réseau**, poser un titre : il s'affiche, puis **disparaît**, et
   l'alerte « Réessayer » s'affiche. Rétablir, réessayer : il tient.

Le 4 est le seul qui compte. Un affichage optimiste qui ne sait pas se
rétracter est un mensonge.

- [x] **Étape 8 : commit**

```
feat(panel): let an idea be titled from the detail pane

The line is always there, grey when empty: with no visible sign an
in-place editor does not exist. Enter saves, Escape cancels, an
emptied field clears the title, and a failed write puts back the one
that was there.
```

---

## Tâche 8 : la recherche

**Fichiers :**

- Modifier : `src/lib/filterIdeas.ts`
- Modifier : `test/filterIdeas.test.ts`

- [x] **Étape 1 : écrire les tests qui échouent**

Dans `test/filterIdeas.test.ts`, dans le bloc de recherche :

```ts
it('finds an idea by its title', () => {
  const corpus: Idea[] = [
    makeIdea(
      'a',
      null,
      ['un texte sans rapport'],
      'Le coût du no-code',
    ),
    makeIdea('b', null, ['un autre texte'], null),
  ];

  const found = filterIdeas(corpus, { label: ALL, query: 'no-code' });

  expect(found.map((idea) => idea.id)).toEqual(['a']);
});

it('ignores case in a title', () => {
  const corpus: Idea[] = [
    makeIdea('a', null, ['un texte'], 'Le Coût Du No-Code'),
  ];

  expect(
    filterIdeas(corpus, { label: ALL, query: 'coût' }),
  ).toHaveLength(1);
});

it('still finds an untitled idea by its text', () => {
  const corpus: Idea[] = [makeIdea('a', null, ['un texte'], null)];

  expect(
    filterIdeas(corpus, { label: ALL, query: 'texte' }),
  ).toHaveLength(1);
});
```

- [x] **Étape 2 : les lancer, vérifier qu'ils échouent**

```bash
pnpm vitest run --project front filterIdeas
```

Attendu : ÉCHEC sur le premier — l'idée `a` n'est pas trouvée.

- [x] **Étape 3 : couvrir le titre**

Dans `src/lib/filterIdeas.ts`, le dernier filtre :

```ts
return byLabel.filter(
  (idea) =>
    idea.title?.toLowerCase().includes(term) === true ||
    idea.variations.some((variation) =>
      variation.text.toLowerCase().includes(term),
    ),
);
```

- [x] **Étape 4 : relancer**

```bash
pnpm vitest run --project front filterIdeas
pnpm test
pnpm typecheck
pnpm lint
pnpm format
```

- [x] **Étape 5 : commit**

```
feat(panel): search titles alongside the text

A title you cannot find back does half its job.
```

---

## Vérification finale

- [x] `pnpm test` — les deux projets, vert. **286 tests, 31 fichiers.**
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format` — sans erreur. `lint`
      sort 5 avertissements `max-lines`, dont 2 nés de cette brique.
- [x] Les deux fichiers générés, **supprimés puis reconstruits** par
      `generate:types` et `db:types` : `typecheck` passe de 6 erreurs à zéro et
      la suite reste verte. Le clone neuf reste à faire par le PO — il demande
      son `server/.env`.
- [ ] ~~Sur un **clone neuf**~~ : `pnpm install`, `pnpm --dir server install`,
      `docker compose up -d --wait`, `pnpm --dir server db:migrate`,
      `pnpm --dir server db:types`, `pnpm test`. Les deux fichiers générés ne
      sont pas versionnés : c'est le seul moyen de vérifier qu'ils se
      reconstruisent.
- [ ] Les quatre manipulations de la tâche 7, étape 7.
- [x] `docs/title-design.md` décrit encore ce qui a été construit — remis à
      jour après l'audit d'ergonomie. S'il a
      dérivé, c'est le document qu'on corrige, pas la mémoire.

## Ce que ce plan ne fait pas

- **Il ne titre aucune idée existante.** Les 29 idées restent sans titre.
- **Il ne répare pas le défaut connu du provider** — deux écritures dans le
  même aller-retour, la seconde prend la valeur optimiste de la première pour
  « avant ». `setTitle` en hérite comme `setLabel`.
- **Il ne touche ni à `Modifier`/`Reformuler` ni aux touches d'écriture.** Ce
  sont `interface-design.md` et `writing-keys-design.md`, et leurs propres
  plans.
