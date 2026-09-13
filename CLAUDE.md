# idea-pipeline

> Extension Chrome perso de capture et de maturation d'idées de posts LinkedIn.

## Contexte & objectif

Outil **personnel, mono-utilisateur**. Ce n'est pas une appli de notes :
c'est un **pipeline de contenu**. L'unité n'est pas une note figée mais une
**idée vivante** qui évolue par variations successives, de la capture
jusqu'à la publication.

## Méthode de travail

**Règles fermes :**

- **Pas de proposition hors scope.** Tu n'ajoutes aucune fonctionnalité, option,
  abstraction ou dépendance absente. Si une idée hors-scope
  émerge, signale-la en une ligne dans « Notes / Blocage » et **attends** — ne
  l'implémente pas.
- **Pas de décision unilatérale.** Tu n'ouvres pas de décision d'architecture ou
  de produit de ta propre initiative. En cas de doute ou de souci : décris-le clairement au fil de la discussion et arrête-toi.
- **Pas de one-shot.** On avance brique par brique. À l'intérieur d'une
  fonctionnalité : structure d'abord, statique ensuite, dynamique en dernier.
- **Tiens-toi à la Definition of Done.** Tu t'arrêtes quand elle est remplie,
  ni avant, ni au-delà.

**Git — 100 % manuel, géré par moi.** Tu n'exécutes AUCUNE commande Git :
ni commit, ni push, ni pull, ni branche (création/suppression), ni merge,
ni rebase, ni switch. Ta seule contribution : **proposer le texte d'un
message de commit** quand c'est pertinent. C'est moi qui commits et qui
gère le dépôt.

## Stack

Pile **figée**. Ne propose aucune alternative ni ajout de dépendance hors de
cette liste sans qu'on discute et l'autorise explicitement.

- **Gestionnaire de paquets** : pnpm
- **Build** : Vite + `@crxjs/vite-plugin@beta`
- **Langage** : TypeScript (mode strict)
- **UI** : React
- **Type d'app** : extension Chrome, Manifest V3 (service worker)
- **Surface** : Chrome Side Panel API
- **Stockage** : `chrome.storage.local` derrière une couche repository → voir `.claude/rules/storage.md`
- **Styles** : CSS pur, aucun framework UI (ni Tailwind, ni librairie de composants)

**Versions des dépendances.** Quand on autorise l'installation d'une lib,
prends toujours sa **dernière version stable** au moment de l'install. Tiens-les
à jour au fil des patchs et des nouvelles versions stables publiées. N'épingle
une version précise que si on en a déjà discuté (raison de compat).

**Contrainte multi-OS** : rester dans les API Chrome pures, aucun code natif.
Seul `suggested_key` du raccourci diffère par plateforme.

## Conventions & structure

- **Qualité** : ESLint + Prettier, TypeScript en mode strict. Le code livré
  passe `lint`, `format` et `typecheck` sans erreur.
- **Langue du code : anglais, partout.** Variables, types, entités métier,
  noms de fichiers et de composants — tout en anglais (`Idea`, `Variation`,
  `Status`, `IdeaCard`, `ideaRepository`…). Le **français est réservé
  uniquement aux textes affichés à l'utilisateur** (libellés d'UI / microcopie).
- **Pas de sur-ingénierie** : la solution la plus simple qui respecte les bonnes pratiques. Pas d'abstraction « au cas où » non demandée.
- **Arborescence** : voir `.claude/rules/structure.md`.
- **Styles (CSS pur, tokens)** : voir `.claude/rules/css.md`.
- **Stockage (repository)** : voir `.claude/rules/storage.md`.

## Hors-scope du MVP (ne pas construire)

Ces fonctions sont volontairement exclues. Ne les implémente pas — même
partiellement, même « pour préparer le terrain ». Cette liste évoluera,
mais chaque ajout ou retrait se décide en amont (PO/PM), jamais par
Claude Code de sa propre initiative.

- **Pas d'images ni de médias** : une idée et ses variations sont du texte.
- **Pas d'export** (fichier, partage, copie en masse).
- **Pas de synchronisation ni de backend** : tout reste en local via
  `chrome.storage.local`, sur un seul appareil.
- **Pas d'IA** : aucune génération, reformulation ou suggestion automatique.
  La maturation d'une idée est 100 % manuelle.
- **Changement de statut : dans la vue détail uniquement.** Pas de
  changement depuis l'accueil ni la liste.
- **Suppression = définitive.** Pas d'archivage, pas de corbeille,
  pas de restauration.
- **Le panneau latéral ne s'ouvre que sur action explicite** de
  l'utilisateur. Jamais d'auto-ouverture en arrière-plan.
- Convention de message de commit : @.claude/rules/git.md
- **Composants React** : voir `.claude/rules/react.md`.
