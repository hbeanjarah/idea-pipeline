---
description: Arborescence du projet et règle d'organisation — où placer chaque type de fichier.
paths:
  - 'src/**'
---

# Structure du projet

Arborescence cible. Tout nouveau fichier se range selon cette carte. On ne crée
pas de dossier hors de cette structure sans qu'un ticket l'autorise.

```
idea-pipeline/
├── .claude/
│   └── rules/
│       ├── storage.md
│       ├── structure.md
│       └── css.md
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
