---
description: Gestion des dépendances — installation réservée au PO, périmètre de ce que Claude Code peut lancer, et politique de versions. Chargé via import depuis le CLAUDE.md (règle transverse, non liée à un type de fichier).
---

# Dépendances

## Installation — 100 % manuelle, gérée par le PO

Même cadre que Git : **Claude Code n'installe rien.** Il n'exécute aucune
commande qui ajoute, retire ou met à jour une dépendance — ni `pnpm add`, ni
`pnpm remove`, ni `pnpm update`, ni leurs équivalents npm/yarn.

Sa contribution : **proposer la commande exacte**, dire en une ligne pourquoi la
dépendance est nécessaire et dans quelle section elle va (`dependencies` ou
`devDependencies`), puis **s'arrêter et attendre**.

## Ce qui reste autorisé

Ces commandes ne touchent ni `package.json` ni le lockfile :

- **`pnpm install`** — restaurer l'existant (nécessaire pour vérifier qu'un
  checkout neuf fonctionne).
- **Les scripts déjà définis** : `lint`, `format`, `test`, `typecheck`, `build`,
  `generate:types`… Sans eux, la règle « le code livré passe `lint`, `format` et
  `typecheck` sans erreur » serait invérifiable.
- **`pnpm dlx` / `npx`** — évaluer un outil **avant** de décider. C'est la façon
  recommandée de procéder : on vérifie que la lib fait réellement le travail, et
  on ne demande son installation qu'ensuite, en sachant ce qu'on achète.

## Versions

Quand une installation est autorisée, prendre sa **dernière version stable** au
moment de l'install. Tenir les dépendances à jour au fil des patchs et des
nouvelles versions stables. N'épingler une version précise que si on en a déjà
discuté (raison de compatibilité).

## Pile figée

La liste des dépendances autorisées vit dans la section « Stack » du `CLAUDE.md`.
Aucune alternative ni aucun ajout hors de cette liste sans discussion et
autorisation explicite.
