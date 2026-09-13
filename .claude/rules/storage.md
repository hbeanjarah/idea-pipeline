---
description: Modèle de données canonique (Idea, Variation, Status) et couche repository. Référence unique pour toute lecture/écriture du stockage.
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
// Les 4 étapes du pipeline.
type Status = "captured" | "maturing" | "ready" | "published";

// Un état du texte à un instant T.
// APPEND-ONLY : on n'édite ni ne supprime jamais une variation existante ;
// faire évoluer une idée = en ajouter une nouvelle.
interface Variation {
  id: string;
  text: string;
  createdAt: string; // ISO 8601
}

// Une idée vivante = une suite de variations + une étape.
interface Idea {
  id: string;
  status: Status;
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
  changeStatus(ideaId: string, status: Status): Promise<Idea>;
  delete(ideaId: string): Promise<void>; // suppression définitive
}
```

## Invariants

- `variations` n'est jamais vide : `create` pose la première, les suivantes
  arrivent par `addVariation`.
- Variations **append-only en structure** : pas de suppression ni de
  réordonnancement, `id` + `createdAt` immuables. Le `text`, lui, reste
  corrigible via `editVariation` — pour réparer une erreur, pas pour marquer
  une étape ; l'`updatedAt` de l'idée est rafraîchi.
- Les mutateurs (`create`, `addVariation`, `changeStatus`) renvoient l'`Idea`
  à jour — l'appelant ne relit pas via `list()`.
- `updatedAt` est rafraîchi à chaque mutation ; `createdAt` ne bouge jamais.
- Dates en chaînes **ISO 8601** (lisibles, triables, heure incluse).
- Deux implémentations coexistent : le **front** sur `chrome.storage.local`
  derrière `IdeaRepository`, le **serveur** sur PostgreSQL derrière
  `server/src/store/ideas.ts`. Les deux respectent les mêmes invariants ; elles
  ne se parlent pas encore.
- Côté serveur, « `variations` n'est jamais vide » est tenu par la **transaction**
  de `createIdea`, pas par une contrainte SQL — le relationnel ne sait pas
  l'exprimer. Un `INSERT` manuel peut donc le violer.

## Étapes <-> libellés UI

Le code manipule les valeurs anglaises ; l'UI affiche le français. Le mapping
vit côté UI, rappelé ici pour mémoire :

| `Status`    | Libellé UI    |
| ----------- | ------------- |
| `captured`  | Capturé       |
| `maturing`  | En maturation |
| `ready`     | Prêt          |
| `published` | Publié        |

## Hors-périmètre (pour l'instant)

`source`, `tags` et les stats de performance des idées publiées ne font **pas**
partie du modèle. On les ajoutera via un ticket dédié si le besoin se confirme,
en faisant évoluer `Idea` et le repository — pas avant.
