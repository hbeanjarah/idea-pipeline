---
description: Style de code transverse — commentaires, langue du code, sur-ingénierie. Chargé via import depuis le CLAUDE.md (règle transverse, non liée à un type de fichier).
---

# Style de code

Comment on écrit le code, quel que soit le fichier. Les règles de structure
(arborescence, composants, stockage, CSS) vivent dans leurs fichiers respectifs.

## Commentaires

**Jamais de bloc de documentation** en tête de fichier, de classe ou de
fonction. Jamais de commentaire qui paraphrase le code.

**Le code n'est pas l'endroit où l'on consigne les décisions.** Le pourquoi d'un
choix, les options écartées, les arbitrages : tout ça vit dans les documents de
conception (`docs/*-design.md`), qui existent pour ça. Une décision écrite dans
le code est écrite à un second endroit — elle se désynchronise du premier, et
plus personne ne sait lequel fait foi.

On ne commente que ce que le code **ne peut pas dire**, et seulement dans ces
trois cas :

- un piège d'API ou un comportement contre-intuitif d'une lib ;
- une contrainte externe : un contrat à respecter, un fichier à garder
  synchronisé ;
- un **avertissement local** : ce qui casse si on touche à cette ligne.

La frontière entre le troisième cas et une décision est nette :

| | |
| --- | --- |
| ✓ avertissement | « si tu fais X ici, Y casse » |
| ✗ décision | « on a choisi X plutôt que Z parce que… » → document de conception |

**Deux tests, dans cet ordre :**

1. Le commentaire disparaît-il **sans perte d'information** ? Alors il ne devait
   pas être là.
2. Sa place est-elle dans un **document de conception** ? Alors il y va, et pas
   ici.

```typescript
// ✗ paraphrase le code : le nom et l'appel disent déjà ça
// Callers get copies, never the stored object.
const snapshot = (idea: Idea): Idea => structuredClone(idea);

// ✗ consigne une décision : sa place est dans le document de conception
// The join table is chosen over a column so the multiple case can open later
// without touching any data.

// ✓ piège d'API
// Express 5 leaves req.body undefined when no parser matched (a missing
// Content-Type, typically) — that must surface as a 400, not a crash.

// ✓ avertissement local : dit ce qui casse, pas pourquoi on a choisi
// Never index this column as unique: every seal uses a fresh IV, so two
// identical names write two different values.
```

Un commentaire qui référence un ticket, un fichier ou une décision doit pointer
vers quelque chose **qui existe**. Une référence morte est du bruit : on la
retire. Renvoyer au document de conception plutôt que de recopier son contenu
est la bonne façon de faire — en le nommant, pour que la référence se vérifie.

## Langue du code

**Anglais, partout.** Variables, types, entités métier, noms de fichiers et de
composants — tout en anglais (`Idea`, `Variation`, `Status`, `IdeaCard`,
`ideaRepository`…), commentaires compris.

Le **français est réservé aux textes destinés à l'utilisateur** : libellés d'UI
et microcopie. Les messages d'erreur de l'API en font partie — ce sont ceux du
contrat (`docs/api-design.md`), repris mot pour mot.

## Pas de sur-ingénierie

La solution la plus simple qui respecte les bonnes pratiques. Pas d'abstraction
« au cas où » non demandée. On factorise quand le **2ᵉ cas réel** apparaît, pas
avant.
