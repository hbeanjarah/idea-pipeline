---
description: Modèle de données canonique (Idea, Variation, Label) et couche repository. Référence unique pour toute lecture/écriture du stockage.
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "server/**/*.ts"
---

# Stockage & modèle de données

> **Source de vérité — à lire en premier.** Depuis que les types du serveur
> sont générés (`docs/openapi.yaml` → `server/src/domain/api.generated.ts`),
> c'est le **spec OpenAPI qui fait foi pour la _forme_ du modèle**. Ne modifie
> jamais un type généré : édite le spec, puis `pnpm --dir server generate:types`.
> Le fichier généré n'est pas versionné (hook `prepare`) ; un test échoue si la
> copie locale a pris du retard sur le spec.
>
> Ce fichier reste la référence pour ce que le spec ne sait **pas** exprimer :
> les **invariants** ci-dessous. Le front (`src/storage/types.ts`) est encore
> écrit à la main — sa génération est une brique à venir.
>
> **Le stockage, lui, est décrit par `server/migrations/*.sql`.** Ne modifie
> jamais `server/src/store/schema.generated.ts` : écris une migration, puis
> lance `pnpm --dir server db:migrate && pnpm --dir server db:types`. L'ordre
> compte — régénérer contre une base non migrée ne lève aucune erreur, elle
> produit une interface `DB` **vide**. Ce fichier n'est pas versionné et aucun
> hook ne le recrée : `prepare` reste hors ligne, donc un clone neuf ne compile
> qu'après ces deux commandes.

Tout le code s'aligne sur ces types et ces noms — en anglais. Les libellés
français vivent côté UI uniquement.

## Modèle

```typescript
// Une étape du pipeline, écrite par l'utilisateur. Le nom est du contenu, pas
// une valeur du domaine : rien dans le code ne connaît « Maturation ».
interface Label {
  id: string;
  name: string;
  color: number; // un rang dans la palette, 1 à 8 — jamais une couleur
  position: number; // 1..n, l'ordre choisi par l'utilisateur
}

// Un état du texte à un instant T.
// APPEND-ONLY : on n'édite ni ne supprime jamais une variation existante ;
// faire évoluer une idée = en ajouter une nouvelle.
interface Variation {
  id: string;
  text: string;
  createdAt: string; // ISO 8601
}

// Une idée vivante = une suite de variations, et au plus une étape.
interface Idea {
  id: string;
  labelId: string | null; // null = libre, sans étape
  title: string | null; // null = sans titre ; jamais demandé à la capture
  variations: Variation[]; // toujours >= 1 (la capture initiale)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601, rafraîchi à chaque mutation
}
```

## Repository

Toute lecture/écriture passe par cette interface. **Aucun accès direct à
`chrome.storage` ailleurs dans le code.**

```typescript
interface IdeaRepository {
  list(): Promise<Idea[]>;
  create(text: string): Promise<Idea>; // crée l'idée + sa 1re variation
  addVariation(ideaId: string, text: string): Promise<Idea>;
  editVariation(
    ideaId: string,
    variationId: string,
    text: string,
  ): Promise<Idea>;
  setLabel(ideaId: string, labelId: string | null): Promise<Idea>; // null détache
  setTitle(ideaId: string, title: string | null): Promise<Idea>; // null retire
  delete(ideaId: string): Promise<void>; // suppression définitive
}

interface LabelRepository {
  list(): Promise<Label[]>;
  create(name: string): Promise<Label>;
  rename(labelId: string, name: string): Promise<Label>;
  delete(labelId: string): Promise<void>; // ses idées redeviennent libres
  reorder(ids: string[]): Promise<Label[]>; // la liste ordonnée entière
}
```

`reorder` prend **toute** la liste, pas une position par étape : N appels dont
l'entrelacement produit des ordres incohérents, contre un seul qui ne peut pas
se contredire.

L'implémentation vivante est `src/storage/remote.ts` : elle **ne touche à rien**
elle-même, elle envoie un message au service worker. Le panneau ne fait aucun
appel réseau et ne voit jamais le jeton de session.

## Invariants

- `variations` n'est jamais vide : `create` pose la première, les suivantes
  arrivent par `addVariation`.
- Variations **append-only en structure** : pas de suppression ni de
  réordonnancement, `id` + `createdAt` immuables. Le `text`, lui, reste
  corrigible via `editVariation` — pour réparer une erreur, pas pour marquer
  une étape ; l'`updatedAt` de l'idée est rafraîchi.
- Les mutateurs (`create`, `addVariation`, `setLabel`) renvoient l'`Idea`
  à jour — l'appelant ne relit pas via `list()`.
- `updatedAt` est rafraîchi à chaque mutation ; `createdAt` ne bouge jamais.
- Dates en chaînes **ISO 8601** (lisibles, triables, heure incluse).
- **Une seule source de vérité : PostgreSQL**, derrière
  `server/src/store/ideas.ts` et `server/src/store/labels.ts`. Le front
  l'atteint par son service worker. `chrome.storage.local` ne porte plus aucune
  idée : l'ancienne implémentation a été supprimée avec la bascule.
- **Une idée porte au plus une étape**, et la table de liaison
  `idea_labels` le tient par la contrainte nommée `idea_labels_one_per_idea`.
  Sa clé primaire, elle, en autorise déjà plusieurs — voir
  `docs/labels-design.md`.
- **Supprimer une étape libère ses idées**, elle ne les supprime pas : c'est le
  `ON DELETE CASCADE` de `idea_labels.label_id` qui le fait.
- **Une idée et une étape appartiennent à un compte.** Chaque opération des
  deux stores prend un `userId` en premier argument, qui devient un
  `WHERE user_id = $1` ; ce qui appartient à autrui répond `404`, jamais `403`
  — on ne divulgue pas son existence.
- Côté serveur, « `variations` n'est jamais vide » est tenu par la **transaction**
  de `createIdea`, pas par une contrainte SQL — le relationnel ne sait pas
  l'exprimer. Un `INSERT` manuel peut donc le violer.

## Chiffrement au repos

`variations.text`, `labels.name` et `ideas.title` **ne contiennent jamais de
texte lisible**.
Le nom d'une étape est du contenu utilisateur au même titre qu'une note : il
dit sur quoi la personne travaille. La couche `store/` chiffre à l'écriture et
déchiffre à la lecture (`store/notes.ts`, AES-256-GCM) ; rien au-dessus ne le
sait, et c'est voulu : le chiffrement est un détail de persistance, pas une
règle de domaine.

Cinq conséquences à connaître avant de toucher au store :

- **Le service valide le clair, avant** que le store ne chiffre. L'ordre des
  couches ne change pas : Zod voit toujours le texte de l'utilisateur.
- **Le `CHECK (btrim(text) <> '')` ne valide plus la saisie.** Un chiffré n'est
  jamais vide, la contrainte passe donc toujours. C'est le schéma Zod du service
  qui tient la règle « une note n'est pas vide ».
- **Tout nouveau chemin d'écriture doit chiffrer.** `sealed-at-rest.test.ts` lit
  les lignes en SQL brut et échoue si l'un d'eux l'oublie.
- **Aucune contrainte SQL ne peut porter sur une colonne scellée.** Chaque
  scellement tire un IV neuf, donc deux étapes nommées « Prêt » écrivent deux
  valeurs différentes : un index `UNIQUE` ne verrait rien. Les doublons se
  refusent dans `services/labels.ts`, à la casse et aux espaces près.
- **Le serveur ne peut pas compter les idées par étape.** Trier ou grouper sur
  un nom scellé n'a pas de sens ; ces comptes se font côté panneau.

Un identifiant est mêlé à la signature : celui de l'idée pour une variation
**et pour son titre**, celui du compte pour une étape. Une ligne recopiée
ailleurs ne s'ouvre plus.
Détail dans `docs/security-design.md`.

## Les étapes n'ont pas de libellé à traduire

Il n'y a plus de mapping valeur anglaise → libellé français : **le nom d'une
étape est écrit par l'utilisateur**, dans sa langue, et le code ne le connaît
pas. `src/lib/statusLabels.ts` a disparu avec la table qu'il portait.

Un compte neuf n'arrive pas vide pour autant : `seedDefaultLabels` lui pose
quatre étapes à la création — c'est le **seul** endroit du code où ces mots
français existent, et ils y sont une proposition, pas une valeur du domaine.

Le `color` d'une étape est un **rang**, jamais une couleur : les huit valeurs
vivent dans `src/styles/tokens.css`. Un `#rrggbb` en base rendrait le thème
impossible à changer sans réécrire les lignes des utilisateurs.

## Hors-périmètre (pour l'instant)

`source`, `tags` et les stats de performance des idées publiées ne font **pas**
partie du modèle. On les ajoutera via un ticket dédié si le besoin se confirme,
en faisant évoluer `Idea` et le repository — pas avant.
