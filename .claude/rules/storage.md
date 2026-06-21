---
description: Modèle de données canonique (Idea, Variation, Status) et couche repository. Référence unique pour toute lecture/écriture du stockage.
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Stockage & modèle de données

Référence **canonique** du modèle. Tout le code s'aligne sur ces types et ces
noms — en anglais. Les libellés français vivent côté UI uniquement.

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
- Variations **append-only** : aucune édition, aucune suppression d'une
  variation déjà enregistrée.
- Les mutateurs (`create`, `addVariation`, `changeStatus`) renvoient l'`Idea`
  à jour — l'appelant ne relit pas via `list()`.
- `updatedAt` est rafraîchi à chaque mutation ; `createdAt` ne bouge jamais.
- Dates en chaînes **ISO 8601** (lisibles, triables, heure incluse).
- Implémentation MVP sur `chrome.storage.local`, derrière l'interface async —
  un futur adaptateur (IndexedDB, backend) ne touchera pas aux appelants.

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
