---
description: Conventions des composants React — réutilisabilité, séparation présentation/données, props.
paths:
  - "src/**/*.tsx"
---

# Composants React

Objectif : des composants **réutilisables et découplés**, sans sur-ingénierie.

## Présentation vs données

- Les composants réutilisables (`components/`) sont **présentationnels** : ils
  reçoivent données et callbacks en **props**, et ne touchent **jamais** au
  repository (`storage.ts`) ni à `chrome.*` directement.
- L'accès aux données et l'état vivent dans les **écrans** (`screens/`), qui
  passent données + callbacks aux composants.
- Un composant ignore _d'où_ viennent ses données et _ce qui_ suit une action —
  il reçoit `idea`, il appelle `onSubmit(text)`, rien de plus.

## Props

- Chaque composant a une interface `Props` explicite et typée (jamais `any`).
- Props **minimales** : seulement ce dont le composant a besoin. Pas de prop
  « au cas où ».
- Callbacks nommés par l'intention (`onSubmit`, `onSelect`, `onStatusChange`),
  pas par l'implémentation.
- Pas de booléen fourre-tout encodant plusieurs modes : préférer des composants
  distincts ou une prop `variant` explicite.

## Composition

- Un composant = une responsabilité. S'il en fait deux, le découper.
- Préférer la **composition** (enfants / sous-composants) aux props de
  configuration qui s'accumulent.
- Un composant par fichier (cf. structure.md, `no-multi-comp`).

## État

- État **local** (`useState`) tant qu'il ne sert qu'au composant.
- L'état partagé remonte à l'écran parent — pas de store global en MVP.
- `useEffect` uniquement pour la synchro avec l'extérieur (charger les idées au
  montage d'un écran), jamais pour de la logique dérivable au rendu.

## À éviter

- Logique métier dans un composant présentationnel.
- Accès direct au storage hors des écrans.
- Sur-abstraction : pas de composant « générique » spéculatif tant qu'un seul
  cas existe. On factorise quand le **2ᵉ cas réel** apparaît.
