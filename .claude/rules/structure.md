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
│   │   └── index.ts        # service worker
│   ├── sidepanel/          # surface principale (Side Panel)
│   │   ├── index.html      # point d'entrée HTML du panneau
│   │   ├── main.tsx        # bootstrap React
│   │   └── App.tsx         # racine + navigation entre surfaces
│   ├── screens/            # les 3 surfaces du pipeline
│   │   ├── HomeScreen.tsx      # accueil borné
│   │   ├── ListScreen.tsx      # liste complète scrollable
│   │   └── DetailScreen.tsx    # détail d'une idée
│   ├── components/         # briques réutilisables (IdeaCard, Composer, StatusBadge…)
│   ├── storage/
│   │   ├── types.ts        # modèle de domaine : Idea, Variation, Status
│   │   └── storage.ts      # IdeaRepository + implémentation chrome.storage.local
│   └── styles/
│       ├── tokens.css      # design tokens (palette, typo mono, espacements)
│       └── global.css      # reset + base
├── server/                 # API locale (Express 5) — pas encore branchée au front
│   ├── package.json        # ses propres deps + le bloc "imports" (alias #*)
│   ├── tsconfig.json       # éditeur + typecheck (voit les tests)
│   ├── tsconfig.build.json # build seul — exclut les *.test.ts de dist/
│   └── src/
│       ├── index.ts        # bootstrap (listen)
│       ├── app.ts          # assemblage Express : json, routes, fallbacks
│       ├── config/         # env.ts (PORT) · api-error.ts (ApiError)
│       ├── domain/
│       │   ├── api.generated.ts # GÉNÉRÉ, non versionné — ne pas éditer
│       │   └── types.ts    # façade : noms du projet + invariants
│       ├── middleware/     # not-found.ts · error-handler.ts
│       ├── routes/         # URLs et verbes
│       ├── controllers/    # req → service → code HTTP
│       ├── services/       # validation Zod + règles métier
│       └── store/          # persistance (Map en mémoire)
├── docs/
│   ├── api-design.md       # contrat REST + table exhaustive des messages
│   ├── openapi.yaml        # spécification OpenAPI des 6 endpoints
│   └── persistence-design.md # conception de la persistance (PostgreSQL)
├── README.md               # prérequis, installation, comment lancer les deux moitiés
├── CLAUDE.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Où va quoi

- **Types du domaine** (`Idea`, `Variation`, `Status`) → `src/storage/types.ts`.
  Tout le monde les importe de là (détail dans `storage.md`).
- **Accès aux données** → uniquement `src/storage/storage.ts`. Aucun appel
  `chrome.storage` ailleurs.
- **Surfaces** (accueil / liste / détail) → `src/screens/`, une par fichier.
  Navigation entre elles : voir la section ci-dessous.
- **Composants réutilisables** → `src/components/`, un composant par fichier
  (`IdeaCard.tsx`).
- **Styles** → `src/styles/` : `tokens.css` (variables), `global.css` (reset +
  base). Le CSS spécifique à un composant est colocalisé avec lui (détail dans
  `css.md`).
- **Service worker** → `src/background/index.ts`.

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
  racine.

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
