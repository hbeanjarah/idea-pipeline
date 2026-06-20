---
description: Convention de message de commit. Chargé via import depuis le CLAUDE.md (règle transverse, non liée à un type de fichier).
---

# Git — messages de commit

**Cadre** : Git est 100 % manuel (humain). Claude Code n'exécute aucune commande
Git — il **propose uniquement le texte d'un message de commit** quand c'est
pertinent. Commit, branche, push, pull, merge, rebase : jamais de son ressort.

## Format

Conventional Commits, en **anglais** :

```
type: short imperative description
```

- **`type`** parmi : `feat`, `fix`, `refactor`, `chore`, `docs`, `style`,
  `test`, `build`.
- **description** : à l'impératif, en minuscules, sans point final, ~50 car. max.
- **scope** optionnel entre parenthèses : `feat(detail): …`.
- **corps** optionnel (après une ligne vide) pour expliquer le _pourquoi_, si le
  titre ne suffit pas.

## Exemples

- `feat: add idea capture composer`
- `fix(list): keep scrollbar clear of the send chevron`
- `refactor: extract IdeaRepository from the side panel`
- `chore: set up eslint and prettier`

## Portée d'un commit

Un commit = un changement cohérent. Le message décrit _ce qui est fait_, pas
_comment_. Si plusieurs changements indépendants sont prêts, proposer plusieurs
messages distincts plutôt qu'un fourre-tout.
