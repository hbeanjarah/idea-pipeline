---
description: Style de code transverse — commentaires, langue du code, sur-ingénierie. Chargé via import depuis le CLAUDE.md (règle transverse, non liée à un type de fichier).
---

# Style de code

Comment on écrit le code, quel que soit le fichier. Les règles de structure
(arborescence, composants, stockage, CSS) vivent dans leurs fichiers respectifs.

## Commentaires

**Jamais de bloc de documentation** en tête de fichier, de classe ou de
fonction. Jamais de commentaire qui paraphrase le code.

On ne commente que ce que le code **ne peut pas dire** :

- un piège d'API ou un comportement contre-intuitif d'une lib ;
- une contrainte externe : un contrat à respecter, un fichier à garder
  synchronisé ;
- la raison d'un choix qu'un « nettoyage » bien intentionné casserait.

**Test** : si le commentaire disparaît sans perte d'information, il ne devait
pas être là.

```typescript
// ✗ paraphrase le code : le nom et l'appel disent déjà ça
// Callers get copies, never the stored object.
const snapshot = (idea: Idea): Idea => structuredClone(idea);

// ✓ dit ce que le code ne peut pas dire
// Express 5 leaves req.body undefined when no parser matched (a missing
// Content-Type, typically) — that must surface as a 400, not a crash.
```

Un commentaire qui référence un ticket, un fichier ou une décision doit pointer
vers quelque chose **qui existe**. Une référence morte est du bruit : on la
retire.

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
