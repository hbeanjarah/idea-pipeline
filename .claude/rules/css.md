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
  + `IdeaCard.module.css` dans le même dossier.
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
**jamais** une couleur ou un espacement en dur — toujours via un token. Les
valeurs ci-dessous sont extraites de la maquette de référence
(`design/mockup.html`), qui fait foi.

L'ambiance est **froide** (gris-bleu), rehaussée de turquoise. Aucun ton chaud.

**Surfaces & fonds**

| Token       | Valeur    | Usage                            |
| ----------- | --------- | -------------------------------- |
| `--bg`      | `#e8ebf1` | fond de l'app (gris-bleu froid)  |
| `--panel`   | `#f2f6fc` | panneau / surface principale     |
| `--card`    | `#ffffff` | cartes, champ de saisie          |
| `--panelbd` | `#dce4f0` | bordure de panneau               |
| `--cardbd`  | `#e4ebf4` | bordure de carte                 |
| `--capbd`   | `#cdddf0` | bordure du champ de saisie       |
| `--ring`    | `#e3edf9` | halo de focus                    |
| `--spine`   | `#dce4f0` | filet vertical de l'historique   |

**Texte**

| Token     | Valeur    | Usage                       |
| --------- | --------- | --------------------------- |
| `--ink`   | `#323859` | texte principal (bleu nuit) |
| `--muted` | `#6f7891` | texte secondaire            |
| `--hint`  | `#9aa3b5` | placeholder, indices        |
| `--faint` | `#aab2c4` | texte le plus discret       |

**Accents & marque**

| Token      | Valeur    | Usage                           |
| ---------- | --------- | ------------------------------- |
| `--accent` | `#038c8c` | turquoise — action (chevron…)   |
| `--hl`     | `#bdd9f2` | surbrillance (filtre actif)     |
| `--violet` | `#4a3f73` | violet                          |
| `--taupe`  | `#a68776` | taupe                           |
| `--tagbg`  | `#e7eef8` | fond de tag                     |
| `--tagink` | `#5b6480` | texte de tag                    |

**Couleurs de statut** (pastilles) — réutilisent la palette ci-dessus :

| `Status`    | Couleur                |
| ----------- | ---------------------- |
| `captured`  | taupe (`--taupe`)      |
| `maturing`  | violet (`--violet`)    |
| `ready`     | turquoise (`--accent`) |
| `published` | bleu nuit (`--ink`)    |

Les **espacements**, **rayons** et **ombres** suivent eux aussi la maquette.

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
composant — par ex. la **piste de scroll du composer raccourcie en bas** pour
qu'elle s'arrête au-dessus du chevron d'envoi — est colocalisé dans son module.

## Hors-périmètre

Pas de thème sombre, pas d'animations élaborées en MVP.
