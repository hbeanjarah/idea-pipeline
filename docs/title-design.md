# Titre d'une idée — conception

> Une idée porte un titre, distinct de son texte. Il n'est jamais demandé à la
> capture, et il ne bouge pas quand on reformule.

## Pourquoi

Premier retour de test, d'une personne qui utilise l'outil pour de vrai :

> « Lorsque je crée une idée ou une note, quelquefois j'ai tendance à mettre un
> titre ; la description, c'est le corps de mes idées. »

Aujourd'hui une idée n'est qu'une suite de variations, et une variation n'est
qu'un `text`. Le titre que cette personne tape existe donc déjà — il est
simplement noyé dans le même bloc que le reste, et la carte l'affiche comme
n'importe quelle autre ligne.

Deux façons de répondre ont été examinées. La **convention de première ligne**
— pas de champ, la première ligne du texte s'affiche comme un titre — coûte
zéro migration, mais fait vivre le titre dans la variation : reformuler le
réécrit. Or le titre décrit **l'idée**, pas la version. Cette réponse a donc été
écartée au profit d'un **champ porté par l'idée**, malgré son coût : c'est la
première retouche du contrat depuis la mise en ligne.

## Décisions actées

| Sujet            | Décision                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| Porteur          | **l'idée**, jamais la variation — reformuler ne touche pas au titre        |
| Obligatoire ?    | **non** — nullable, une idée peut n'en avoir jamais                        |
| À la capture     | **jamais demandé** — le composer ne change pas                             |
| Où on le pose    | dans le **détail**, en tête du corps, au-dessus de l'étape                 |
| Affordance       | ligne **toujours présente**, « Ajouter un titre » en `--muted` quand vide  |
| Édition          | **en place** au clic, comme « Modifier » et la pastille d'étape            |
| Validation       | `⏎` enregistre · `Échap` annule · **perdre le focus enregistre**           |
| Aide             | affichée **sous le champ pendant l'édition**, jamais au repos              |
| Retirer le titre | **vider le champ** — pas d'action « supprimer le titre » séparée           |
| Longueur         | **80 caractères** au plus                                                  |
| Taille à l'écran | `--text-hero`, **le gras** le sépare du corps — pas de 6ᵉ jeton de taille  |
| Sur la carte     | **titre + extrait** ; l'extrait recule en `--muted` quand un titre le suit |
| Carte sans titre | **inchangée** — une seule forme de carte, avec ou sans sa première ligne   |
| Recherche        | le titre est **cherché** comme le texte des variations, côté client        |
| Écriture         | un chemin dédié, `PATCH /ideas/{id}/title`                                 |
| Chiffrement      | **scellé** par `store/notes.ts`, AAD = **l'id de l'idée**                  |
| Idées existantes | **aucune reprise** — elles restent sans titre jusqu'à ce qu'on les rouvre  |

La maquette interactive de l'affordance est `design/mockup-title.html`.
L'anatomie du volet détail, mise à jour, vit dans `interface-design.md`.

## `⏎` enregistre ici, et va à la ligne ailleurs

Ce n'est pas une exception à `writing-keys-design.md`, c'est la même règle :
`⏎` fait ce que la **nature du champ** commande. Le titre tient sur une ligne,
un saut de ligne n'y existe pas, et `⏎` y valide comme dans tout formulaire ;
le corps d'une idée est un `textarea`, `⏎` y va à la ligne et `Ctrl+⏎`
enregistre. Une seule chose à apprendre, et c'est celle que le web enseigne
déjà.

## Le contrat

### Un chemin, pas un champ de plus

`PATCH /ideas/{id}` existe déjà et porte `setIdeaLabel`. Deux réponses étaient
possibles : élargir cette opération, ou donner au titre la sienne.

**L'API a déjà tranché ce cas.** Chaque `PATCH` du dépôt porte **une** intention
et un corps strict : `PATCH /ideas/{id}` classe, `PATCH /labels/{id}` renomme,
`PATCH /labels` réordonne. Cette dernière ligne est la preuve : réordonner
aurait pu être `PATCH /labels/{id}` avec un `{position}` — c'est un chemin qui
lui a été donné. **Une seconde intention sur une ressource prend un chemin.**

Élargir coûterait par ailleurs trois choses concrètes : le message publié
`Le champ "labelId" est obligatoire.` cesserait d'être vrai ; il faudrait
inventer une catégorie d'erreur « au moins un champ parmi… » que l'API n'a nulle
part ; et côté panneau, deux intentions dans un seul appel brouillent le retrait
optimiste — à l'échec, il faut savoir quoi remettre en place.

### L'opération

`PATCH /ideas/{id}/title`, corps strict `{ "title": string | null }`.

- `200` → l'**`Idea` complète**, comme `setIdeaLabel` et `renameLabel`.
- `null`, ou une chaîne qui ne contient que des espaces, **retire le titre** :
  c'est le « vider le champ » de l'interface, et il ne mérite pas une seconde
  façon de s'exprimer.
- `400` — `Le champ "title" est obligatoire.` (absent, ou d'un type autre qu'une
  chaîne ou `null` ; corps vide inclus) · `Le titre est trop long.` (plus de 80
  caractères) · `Champs non autorisés.` · `Corps de requête JSON invalide.`
- `404` — `Idée introuvable.`

`Idea.title` est **requis et nullable**, comme `labelId` : toujours présent, le
front lit `null`, jamais `undefined`.

**`POST /ideas` ne bouge pas.** Le titre n'est jamais demandé à la capture.

## Le stockage

`ALTER TABLE ideas ADD COLUMN title text` — nullable, scellée, **sans index**.
Même piège que `labels.name` : chaque scellement utilise un IV neuf, donc deux
titres identiques écrivent deux valeurs différentes et un index ne verrait rien.

**Le contexte du scellement est l'id de l'idée**, pas celui du compte.
`store/notes.ts` demande ce dont la valeur ne peut pas être détachée, et
`store/ideas.ts` scelle déjà chaque variation avec `seal(text, idea.id)`. Avec
`user_id`, un titre resterait déplaçable d'une idée à l'autre à l'intérieur d'un
même compte. Le titre n'étant jamais écrit à la création, cet id est toujours
connu au moment de sceller.

La recherche reste **côté client**, sur les valeurs déjà ouvertes : une colonne
scellée ne se cherche pas en SQL.

## Les fichiers touchés

**Le contrat, en premier.** `server/src/routes/contract.test.ts` compare les
routes montées au spec et échoue si une route existe sans entrée : le dépôt
force l'ordre.

| Fichier             | Quoi                                                                           |
| ------------------- | ------------------------------------------------------------------------------ |
| `docs/openapi.yaml` | `Idea.title` · le chemin `/ideas/{id}/title` · le schéma `SetIdeaTitleRequest` |

**Le serveur.**

| Fichier                                | Quoi                                                               |
| -------------------------------------- | ------------------------------------------------------------------ |
| `server/migrations/005_title.sql`      | **créer** — la colonne, avec l'avertissement « ne jamais indexer » |
| `server/src/store/schema.generated.ts` | régénéré par `db:types` — non versionné                            |
| `server/src/domain/api.generated.ts`   | régénéré par `generate:types` — non versionné                      |
| `server/src/store/ideas.ts`            | ouvrir `title` partout où une `Idea` se construit · `setTitle`     |
| `server/src/services/ideas.ts`         | `TitleBody` strict, `parseTitleBody`, `setIdeaTitle`               |
| `server/src/controllers/ideas.ts`      | `setTitle`                                                         |
| `server/src/routes/ideas.ts`           | `patch('/:id/title')`                                              |

**Le front.** Le titre refait à l'identique le trajet de `setLabel` :
`src/storage/types.ts` → `src/lib/protocol.ts` → `src/background/api.ts` →
`src/background/messages.ts` → `src/storage/remote.ts`, avec `ideas/setTitle` et
son entrée dans `ReplyData`. Puis :

| Fichier                        | Quoi                                                                    |
| ------------------------------ | ----------------------------------------------------------------------- |
| `src/hooks/IdeasProvider.tsx`  | `setTitle` optimiste — même forme que `setLabel`, restitution à l'échec |
| `src/hooks/useIdeas.ts`        | la signature                                                            |
| `src/components/IdeaTitle/`    | **créer** — lecture, édition au clic, `⏎` / `Échap` / perte de focus    |
| `src/screens/DetailScreen.tsx` | la poser en tête du corps, au-dessus de `LabelPicker`                   |
| `src/components/IdeaCard/`     | titre + extrait, l'extrait recule en `--muted`                          |
| `src/lib/filterIdeas.ts`       | la recherche couvre le titre                                            |

## Les tests

- `routes/contract.test.ts` — la route a son entrée dans le spec.
- `services/ideas.test.ts` — les quatre `400` du nouveau corps.
- `store/ideas.test.ts` — écrire un titre, le relire, le retirer.
- `store/sealed-at-rest.test.ts` — un `SELECT title` ne rend rien en clair.
- `isolation.test.ts` — titrer l'idée d'autrui répond `404`.
- `test/filterIdeas.test.ts` — une idée se trouve par son titre.
- `test/remote.test.ts`, `test/messages.test.ts` — le nouvel aller-retour.
- `test/optimistic.test.ts` — la fixture d'idée porte le champ nouveau.
  **Le retrait à l'échec, lui, se vérifie à la main** : voir la note plus bas.

## L'ordre des briques

Structure, puis statique, puis dynamique.

1. Le spec et les types générés.
2. La migration et le store, avec leurs tests.
3. Service, controller, route.
4. Le trajet panneau ↔ worker.
5. **L'affichage seul** : la ligne de titre en lecture, la carte.
6. L'édition en place et l'affichage optimiste.
7. La recherche.

Les briques 1 à 4 ne changent rien à l'écran. La 5 montre les titres sans
permettre d'en poser. La première fois qu'on pourra titrer une idée, c'est à
la 6.

## Hors périmètre

- **Un titre demandé à la capture.** Nommer une idée est un acte de maturation :
  au moment où elle arrive, on ne sait souvent pas encore ce qu'elle est.
- **Un titre par variation.** Le titre décrit l'idée ; s'il bougeait d'une
  version à l'autre, il ne la décrirait plus.
- **Titrer les idées existantes.** Elles restent sans titre. Les reprendre en
  masse serait un script ponctuel, jamais une fonctionnalité.
- **Chercher le titre côté serveur.** La colonne est scellée ; ce serait un
  autre sujet, avec d'autres garanties.

## Notes / Blocage

- **L'état « sans titre » est définitif dans l'interface.** La colonne est
  nullable, donc chaque surface qui montre un titre montre aussi son absence.
  C'est assumé : le rendre obligatoire coûterait la promesse de capture.
- **Le retrait optimiste ne se teste pas automatiquement, et ce n'est pas
  propre au titre.** La rétractation vit dans `IdeasProvider`, un composant
  React, et le dépôt n'a pas de harnais DOM : `test/optimistic.test.ts`
  n'éprouve que les fonctions pures de `src/lib/optimistic.ts`, dont
  `setLabel` et `setTitle` ne se servent pas. La vérification est **manuelle,
  réseau coupé**, comme celle de `setLabel` avant elle. En ajouter une
  automatique demanderait une dépendance de test nouvelle — à décider, pas à
  glisser ici.
- **Le retrait optimiste hérite du défaut connu de `setLabel`.** Deux écritures
  lancées dans le même aller-retour font que la seconde prend la valeur
  optimiste de la première pour « avant ». Réessayer resynchronise. Ce n'est pas
  réparé ici — ce serait le réparer pour tout le provider.
