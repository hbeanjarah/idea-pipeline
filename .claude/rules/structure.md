---
description: Arborescence du projet (extension + API locale) et règle d'organisation — où placer chaque type de fichier.
paths:
  - "src/**"
  - "server/**"
---

# Structure du projet

Arborescence cible. Tout nouveau fichier se range selon cette carte. On ne crée
pas de dossier hors de cette structure sans qu'un ticket l'autorise.

```
idea-pipeline/
├── .claude/
│   └── rules/
│       ├── chrome-extension.md
│       ├── code-style.md
│       ├── dependencies.md
│       ├── css.md
│       ├── git.md
│       ├── react.md
│       ├── storage.md
│       └── structure.md
├── public/
│   └── icons/              # icônes de l'extension (16/32/48/128)
├── src/
│   ├── manifest.ts         # manifest MV3, typé, importé par Vite
│   ├── background/
│   │   ├── index.ts        # service worker : reçoit les messages du panneau
│   │   ├── messages.ts     # un cas par requête du protocole
│   │   ├── api.ts          # le SEUL client HTTP du dépôt côté front
│   │   ├── session.ts      # le jeton, dans chrome.storage.session
│   │   ├── google.ts       # launchWebAuthFlow + échange du code
│   │   └── pkce.ts         # verifier, challenge, base64url
│   ├── sidepanel/          # surface principale (Side Panel)
│   │   ├── index.html      # point d'entrée HTML du panneau
│   │   ├── main.tsx        # bootstrap React
│   │   └── App.tsx         # racine + navigation entre surfaces
│   ├── screens/            # les 3 surfaces du pipeline
│   │   ├── HomeScreen.tsx      # accueil borné
│   │   ├── ListScreen.tsx      # liste complète scrollable
│   │   └── DetailScreen.tsx    # détail d'une idée
│   ├── components/         # briques réutilisables (IdeaCard, Composer,
│   │                       #   Avatar, AccountMenu, ActionMenu, Popover…)
│   ├── hooks/              # IdeasProvider, SessionProvider et leurs hooks
│   │   └── useFailureRetry.ts  # ce qui a échoué + comment le rejouer
│   ├── lib/                # protocol.ts (contrat panneau ↔ worker), config, failures
│   │                       #   statusLabels.ts  libellés FR des 4 étapes
│   │                       #   variations.ts    la variation courante
│   │                       #   optimistic.ts    affichage avant confirmation
│   ├── storage/
│   │   ├── types.ts        # modèle de domaine : Idea, Variation, Status, User
│   │   ├── remote.ts       # IdeaRepository passant par le service worker
│   │   └── storage.ts      # ancienne implémentation chrome.storage.local
│   └── styles/
│       ├── tokens.css      # design tokens (palette, typo mono, espacements)
│       └── global.css      # reset + base
├── server/                 # API locale (Express 5 + PostgreSQL), servie au front
│   ├── package.json        # ses propres deps + le bloc "imports" (alias #*)
│   ├── tsconfig.json       # éditeur + typecheck (voit src/ et test/)
│   ├── tsconfig.build.json # build seul — exclut les *.test.ts et test/ de dist/
│   ├── migrations/         # *.sql versionnés — LA source du schéma
│   ├── test/               # harnais vitest : conteneur PostgreSQL + TRUNCATE
│   └── src/
│       ├── index.ts        # bootstrap (listen)
│       ├── app.ts          # assemblage Express : json, routes, fallbacks
│       ├── config/         # env.ts (PORT, DATABASE_URL) · api-error.ts (ApiError)
│       ├── domain/
│       │   ├── api.generated.ts # GÉNÉRÉ, non versionné — ne pas éditer
│       │   └── types.ts    # façade : noms du projet + invariants
│       ├── middleware/     # not-found.ts · error-handler.ts
│       ├── routes/         # URLs et verbes
│       ├── controllers/    # req → service → code HTTP
│       ├── services/       # validation Zod + règles métier
│       └── store/          # persistance PostgreSQL, via Kysely
│           ├── db.ts               # instance Kysely, construite à la 1re requête
│           ├── ideas.ts            # les 6 opérations du domaine
│           ├── notes.ts            # seal/open — le SEUL endroit qui chiffre
│           ├── seal.ts             # reprise des lignes écrites avant le chiffrement
│           ├── seal-cli.ts         # point d'entrée de `db:seal`
│           ├── migrations.ts       # runner : applique les fichiers .sql
│           ├── migrate-cli.ts      # point d'entrée de `db:migrate`
│           └── schema.generated.ts # GÉNÉRÉ depuis la base, non versionné
├── docs/
│   ├── api-design.md       # contrat REST + table exhaustive des messages
│   ├── openapi.yaml        # spécification OpenAPI des 6 endpoints
│   ├── persistence-design.md # conception de la persistance (PostgreSQL)
│   └── persistence-plan.md # son plan d'implémentation
├── docker-compose.yml      # PostgreSQL de développement
├── README.md               # prérequis, installation, comment lancer les deux moitiés
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts        # 2 projets : front · server (conteneur PostgreSQL)
```

## Où va quoi

- **Types du domaine** (`Idea`, `Variation`, `Status`, `User`) →
  `src/storage/types.ts`. Tout le monde les importe de là (détail dans
  `storage.md`).
- **Accès aux données** → uniquement à travers un `IdeaRepository`. Le panneau ne
  fait **aucun appel réseau** : il envoie un message au service worker, seul
  détenteur du jeton et seul à parler à l'API.
- **Le contrat panneau ↔ worker** vit dans `src/lib/protocol.ts`. Un message
  nouveau s'y déclare d'abord — la table `ReplyData` dit ce que chacun répond.
- **Surfaces** (accueil / liste / détail) → `src/screens/`, une par fichier.
  Navigation entre elles : voir la section ci-dessous.
- **Composants réutilisables** → `src/components/`, un composant par fichier
  (`IdeaCard.tsx`).
- **Styles** → `src/styles/` : `tokens.css` (variables), `global.css` (reset +
  base). Le CSS spécifique à un composant est colocalisé avec lui (détail dans
  `css.md`).
- **Service worker** → `src/background/`. Une seule porte d'entrée
  (`messages.ts`), un seul client HTTP (`api.ts`).
- **Deux conventions d'alias**, à ne pas confondre : `@/` pointe la racine de
  `src/` **côté front** ; `#` est le subpath import de Node, réservé au
  **serveur**. Aucun des deux ne traverse la frontière.

## Où va quoi — backend (`server/src/`)

- **Modèle du domaine** → `domain/types.ts`. Miroir de `src/storage/types.ts`
  (front) et de `docs/openapi.yaml` : les trois évoluent **ensemble**.
- **Une requête traverse les couches dans cet ordre**, jamais autrement :

  `routes/` (URL + verbe) → `controllers/` (lit `req`, pose le code HTTP) →
  `services/` (valide avec Zod, applique les règles, lève `ApiError`) →
  `store/` (persistance)

- Un **controller** ne valide pas et ne touche jamais au store. Un **service**
  ne connaît ni `req` ni `res` — c'est ce qui le rend testable sans HTTP.
- **Erreurs** → `config/api-error.ts`. `middleware/error-handler.ts` est le
  **seul** endroit qui écrit un corps d'erreur ; les messages sont ceux du
  contrat, mot pour mot (`docs/api-design.md`).
- **Imports entre couches** : subpath imports Node, sans extension de fichier —
  `#services/ideas`, `#config/api-error`. Jamais de chemin relatif d'une couche
  à l'autre. Le mapping vit dans `server/package.json`, avec une condition
  `development` pour que `tsc`, `tsx` et vitest lisent `src/` plutôt qu'un
  `dist/` périmé.
- **Tests colocalisés** : `ideas.test.ts` à côté de `ideas.ts`. C'est une
  divergence assumée avec le front, qui garde les siens dans `test/` à la
  racine. `server/test/` ne contient **pas** de tests : seulement le harnais
  qui démarre le conteneur PostgreSQL et vide la base entre chaque test.
- **Chiffrement** → `store/notes.ts`, et nulle part ailleurs. Aucune autre
  couche n'appelle `seal` ou `open` (détail dans `storage.md`).
- **Schéma de la base** → une nouvelle migration dans `server/migrations/`,
  jamais un `ALTER` à la main. Puis `db:migrate && db:types` (détail dans
  `storage.md`).

## Navigation

Pas de routeur en MVP (Side Panel : pas d'URL, pas de deep-link — un routeur
n'apporterait rien). La navigation entre les 3 surfaces vit à **un seul
endroit** :

- un type `Route` unique (union discriminée) = source de vérité ;
- `App.tsx` est le seul à mapper `Route` → écran ;
- les écrans reçoivent une fonction `navigate` (et leurs params) en props ;
  ils n'accèdent jamais à l'état de route directement.

Cette discipline garde une éventuelle migration vers react-router triviale
(seul `App.tsx` change), si un jour le besoin se présente.

## Principe

Pas de dossier spéculatif : un dossier apparaît quand un fichier a besoin d'y
vivre, pas « au cas où ». Si une nouvelle catégorie émerge (hooks, utilitaires),
on l'ajoute via un ticket, pas en avance.

## Note d'init

Les points d'entrée exacts (emplacement du `manifest.ts`, du HTML du side panel)
peuvent être ajustés à la marge à l'init, selon ce qu'impose
`@crxjs/vite-plugin`. Cette carte fixe l'intention ; le ticket d'init la
matérialise.
