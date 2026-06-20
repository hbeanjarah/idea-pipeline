---
description: Organisation du CSS (CSS Modules, colocalisation), design tokens et charte typographique.
paths:
  - "src/**/*.css"
---

# CSS & design tokens

CSS pur, **aucun framework UI** (ni Tailwind, ni librairie de composants).

## Organisation

- **CSS Modules** : tout style de composant est un `*.module.css`. Vite scope
  les classes par fichier — aucune collision possible, aucune convention de
  préfixe à tenir. Côté JSX : `import styles from './IdeaCard.module.css'` puis
  `className={styles.ideaCard}`.
- **Colocalisation** : le CSS d'un composant vit à côté de lui — `IdeaCard.tsx`
  - `IdeaCard.module.css` dans le même dossier.
- **Deux fichiers globaux** dans `src/styles/`, non scopés :
  - `tokens.css` — design tokens (variables CSS sur `:root`). **Uniquement des
    variables**, aucune règle visuelle.
  - `global.css` — reset minimal maison + base (`body`, `box-sizing`, typo par
    défaut). Importé une seule fois au bootstrap.

## Nommage des classes

Les classes d'un `*.module.css` sont locales : on les écrit en **kebab-case**
(`.idea-card`, `.status-badge`) et on règle Vite avec
`css.modules.localsConvention: 'camelCaseOnly'`, pour y accéder en camelCase
côté JS (`styles.ideaCard`). CSS idiomatique d'un côté, accès propre de l'autre.

## Design tokens

Toute valeur partagée est une variable CSS dans `tokens.css`. Le code ne pose
**jamais** une couleur ou un espacement en dur — toujours via un token.

Familles : couleurs de marque, couleurs de statut, neutres, typographie,
espacements, rayons.

**Palette de marque** (valeurs de référence, calées sur la maquette validée) :

| Token            | Valeur    | Usage                        |
| ---------------- | --------- | ---------------------------- |
| `--brand-navy`   | `#323859` | bleu nuit, ancrage           |
| `--brand-turq`   | `#038C8C` | turquoise, action principale |
| `--brand-violet` | `#4A3F73` | violet                       |
| `--brand-taupe`  | `#A68776` | taupe                        |
| `--brand-sky`    | `#BDD9F2` | bleu clair                   |
| `--brand-mint`   | `#5DCCB0` | menthe                       |
| `--bg-cream`     | `#F7F3D7` | fond de l'app                |

Le dégradé `--brand-navy → --brand-turq` est le motif d'accent récurrent ; le
turquoise plein porte l'action (chevron d'envoi, etc.).

**Couleurs de statut** (pastilles) — réutilisent la marque :

| `Status`    | Token                | Couleur   |
| ----------- | -------------------- | --------- |
| `captured`  | `--status-captured`  | taupe     |
| `maturing`  | `--status-maturing`  | violet    |
| `ready`     | `--status-ready`     | turquoise |
| `published` | `--status-published` | bleu nuit |

Les **neutres** (texte, bordures beige, carte sélectionnée blanche),
**espacements**, **rayons** et **ombres** suivent la maquette validée : ce sont
ses valeurs qui font foi. Le ticket « Base CSS » les transcrit dans `tokens.css`.

## Typographie

Deux familles, **toutes deux système** (pas de webfont : zéro dépendance, zéro
latence) :

- `--font-sans` (stack système) → corps des idées, libellés de statut, boutons,
  titres.
- `--font-mono` (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, …`)
  → **uniquement les métadonnées**.

Mono **+ `tabular-nums`** sur : dates de version (avec l'heure, effet
timestamp), compteurs (filtres, nombre de versions, « voir plus »), tags.
**Jamais** de mono sur le corps d'une idée, les libellés de statut, les boutons
ou les titres.

## Scrollbars

Zones scrollables (liste, composer auto-extensible) : scrollbar fine et discrète
(~8px, coins arrondis), stylée via `::-webkit-scrollbar`. Le détail propre à un
composant (ex. décalage de piste du composer pour ne pas chevaucher le chevron)
est colocalisé dans son module.

## Hors-périmètre

Pas de thème sombre, pas d'animations élaborées en MVP.
