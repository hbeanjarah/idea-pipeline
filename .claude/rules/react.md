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
- Exemple du « 2ᵉ cas réel » : `ActionMenu` n'est né que le jour où un **second**
  menu « ⋮ » identique est apparu. Il ne factorise pas que le balisage — il
  absorbe le `close()` avant l'action, que les deux appelants devaient penser à
  faire eux-mêmes.
- Même règle pour `CurrentVersion` : il naît le jour où la bascule
  lecture/édition existe à **deux** endroits distincts — la version courante et
  les versions précédentes de `VariationThread`.
- Et `Spinner`, le jour où le bouton de connexion et le contrôle de session en
  ont voulu un chacun. Même bénéfice qu'`ActionMenu` : il absorbe une décision
  que les deux appelants auraient dû reprendre — avec `label` il s'annonce
  (`role="status"`), sans il est `aria-hidden`, parce qu'un bouton qui dit déjà
  « Connexion en cours… » ne doit pas l'être deux fois. Sa **taille** reste chez
  l'appelant via `className`, comme le glyphe d'`ActionMenu`.

## État

- État **local** (`useState`) tant qu'il ne sert qu'au composant.
- L'état partagé remonte à l'écran parent — pas de store global en MVP.
- `useEffect` uniquement pour la synchro avec l'extérieur (charger les idées au
  montage d'un écran), jamais pour de la logique dérivable au rendu.

## Entorses assumées

Une règle qu'on enfreint sciemment se consigne, sinon elle se perd et l'entorse
devient la norme.

- **`Composer` possède son texte _et_ son échec.** Un composant présentationnel
  ne devrait porter ni l'un ni l'autre. Mais c'est lui qui détient le texte non
  encore enregistré : si l'échec remontait à l'écran, un « Réessayer » réussi ne
  pourrait pas vider le champ, et l'utilisateur verrait son texte deux fois.
  L'état reste donc là où se trouve la chose à protéger.
- **`ListScreen` lit deux contextes** (`useIdeas` et `useSession`). C'est un
  écran, donc il en a le droit — mais il est le seul, et l'identité ne s'affiche
  que là.
- **`IdeasProvider` fabrique une idée que le serveur n'a pas encore vue.** Le
  statut initial et les dates sont devinés côté panneau : une règle serveur
  dupliquée, le temps d'un aller-retour. Sans elle, la promesse de rapidité du
  produit ne tient pas sur une API distante.

## À éviter

- Logique métier dans un composant présentationnel.
- Accès direct au storage hors des écrans.
- Sur-abstraction : pas de composant « générique » spéculatif tant qu'un seul
  cas existe. On factorise quand le **2ᵉ cas réel** apparaît.
