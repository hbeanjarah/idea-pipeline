# idea-pipeline

> Extension Chrome de capture et de maturation d'idées de posts LinkedIn,
> et l'API multi-utilisateur qui la sert.

## Contexte & objectif

Ce n'est pas une appli de notes : c'est un **pipeline de contenu**. L'unité
n'est pas une note figée mais une **idée vivante** qui évolue par variations
successives, de la capture jusqu'à la publication.

**Produit multi-utilisateur.** Chacun se connecte avec son compte Google et
dispose d'un pipeline **étanche** : une idée appartient à une personne, et
personne d'autre ne la voit. L'API est destinée à être hébergée, pour être
joignable depuis plusieurs navigateurs à la fois — puis, plus tard, depuis une
application mobile.

Le dépôt tient deux moitiés : l'**extension** (`src/`), fonctionnelle et qui
persiste dans `chrome.storage.local`, et l'**API** (`server/`), qui sert le
contrat de `docs/` et persiste dans PostgreSQL. **Les deux ne sont pas encore
branchées** — le front n'appelle pas le serveur.

**Ce qui est décidé n'est pas ce qui est construit.** L'authentification, le
cloisonnement par compte et l'hébergement sont **conçus**
(`docs/auth-design.md`) et **pas encore implémentés**. À ce jour l'API tourne en
local, sans comptes : elle sert toutes les idées à quiconque l'interroge. Ne
suppose jamais qu'un `userId` existe quelque part tant que la brique
correspondante n'est pas livrée.

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

**Commun aux deux moitiés** : pnpm · TypeScript (mode strict) · vitest.

**Front — l'extension (`src/`)**

- **Build** : Vite + `@crxjs/vite-plugin@beta`
- **UI** : React
- **Type d'app** : extension Chrome, Manifest V3 (service worker)
- **Surface** : Chrome Side Panel API
- **Stockage** : `chrome.storage.local` derrière une couche repository → voir `.claude/rules/storage.md`
- **Styles** : CSS pur, aucun framework UI (ni Tailwind, ni librairie de composants)

**Back — l'API (`server/`)**

- **Runtime** : Node en ESM (`"type": "module"`)
- **Framework** : Express 5
- **Modèle** : types **générés** depuis `docs/openapi.yaml` via
  `openapi-typescript`. Le spec est la source unique. Le fichier généré n'est
  **pas** versionné : le hook `prepare` le recrée à chaque `pnpm install`, et
  un test échoue si la copie locale a pris du retard sur le spec.
- **Validation** : Zod — schémas stricts, calqués sur `docs/openapi.yaml`
- **Stockage** : PostgreSQL 17 (Docker Compose), accédé avec **Kysely**. Le
  schéma vit dans `server/migrations/*.sql` — c'est lui la source de vérité, les
  types TS en sont dérivés par `kysely-codegen` → voir
  `.claude/rules/storage.md`
- **Authentification** _(conçue, pas encore construite)_ : comptes Google
  (OAuth 2.0 + PKCE), sessions **opaques en base** et révocables — pas de JWT
  auto-porté. Aucune dépendance : `fetch` et `node:crypto` suffisent → voir
  `docs/auth-design.md`
- **Exécution** : `tsx` en dev, `tsc` pour le build
- **Imports** : subpath imports Node (`#services/ideas`), sans extension →
  voir `.claude/rules/structure.md`

**Dépendances** — qui installe, ce que tu peux lancer, politique de versions :
voir `.claude/rules/dependencies.md`.

**Contrainte multi-OS** : rester dans les API Chrome pures, aucun code natif.
Seul `suggested_key` du raccourci diffère par plateforme.

## Conventions & structure

- **Qualité** : ESLint + Prettier, TypeScript en mode strict. Le code livré
  passe `lint`, `format` et `typecheck` sans erreur.
- **Style de code** (commentaires, langue, sur-ingénierie) : voir
  `.claude/rules/code-style.md`.
- **Arborescence** : voir `.claude/rules/structure.md`.
- **Composants React** : voir `.claude/rules/react.md`.
- **Styles (CSS pur, tokens)** : voir `.claude/rules/css.md`.
- **Stockage (repository)** : voir `.claude/rules/storage.md`.
- **Messages de commit** : voir `.claude/rules/git.md`.
- **Dépendances** (installation, versions) : voir
  `.claude/rules/dependencies.md`.

## Hors-scope du MVP (ne pas construire)

Ces fonctions sont volontairement exclues. Ne les implémente pas — même
partiellement, même « pour préparer le terrain ». Cette liste évoluera,
mais chaque ajout ou retrait se décide en amont (PO/PM), jamais par
Claude Code de sa propre initiative.

- **Pas d'images ni de médias** : une idée et ses variations sont du texte.
- **Pas d'export** (fichier, partage, copie en masse) **en tant que
  fonctionnalité**. Un script ponctuel de reprise de données n'en est pas un.
- **Pas d'écriture hors ligne ni de synchronisation.** L'API est la seule source
  de vérité : sans réseau, l'écriture échoue et l'interface propose de
  réessayer. Un cache local en repli et une vraie synchronisation entre
  appareils sont des sujets ouverts, volontairement reportés.
- **Pas de partage entre comptes.** Chaque pipeline est étanche : ni lecture, ni
  édition croisée, ni rôles, ni notion d'équipe.
- **Pas d'IA** : aucune génération, reformulation ou suggestion automatique.
  La maturation d'une idée est 100 % manuelle.
- **Changement de statut : dans la vue détail uniquement.** Pas de
  changement depuis l'accueil ni la liste.
- **Suppression = définitive.** Pas d'archivage, pas de corbeille,
  pas de restauration.
- **Le panneau latéral ne s'ouvre que sur action explicite** de
  l'utilisateur. Jamais d'auto-ouverture en arrière-plan.
