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
**jamais** une couleur, un espacement ou une taille de police en dur — toujours
via un token.

L'ambiance est **froide** (gris-bleu), rehaussée de turquoise. Aucun ton chaud.

**Surfaces & fonds — deux niveaux, pas trois**

| Token       | Valeur    | Usage                                       |
| ----------- | --------- | ------------------------------------------- |
| `--sunken`  | `#e2e8f2` | le fond, et toute colonne qui ne porte rien |
| `--surface` | `#fcfdff` | cartes, champs, volet détail, popovers      |
| `--panelbd` | `#dce4f0` | bordure de panneau                          |
| `--cardbd`  | `#e4ebf4` | bordure de carte                            |
| `--capbd`   | `#cdddf0` | bordure du champ de saisie                  |
| `--ring`    | `#e3edf9` | fond de survol discret                      |
| `--spine`   | `#dce4f0` | filet vertical de l'historique              |

Le palier entre les deux vaut **1,210:1**. Il en existait trois auparavant,
séparés de 1,085:1 et 1,101:1 — sous le seuil où l'œil les distingue seul, si
bien que ce sont les bordures qui portaient toute la structure.

**Une troisième surface ne se rajoute pas.** Il faudrait loger trois valeurs
entre 89 % et 100 % de clarté : elles redeviendraient indistinctes. Pour
détacher un élément, on emploie la bordure, le halo ou l'ombre — pas un
quatrième gris. La teinte froide (~218°) se tient sur **toutes** les valeurs
neutres, y compris `--surface` : l'ancien `--card` était du blanc pur, seule
valeur neutre d'une série froide.

**Texte — deux niveaux, et un seuil**

Toute couleur qui porte du texte atteint **4,5:1** (WCAG AA) sur **chacune**
des surfaces où elle se pose. C'est `--sunken` qui commande : c'est le fond le
plus sombre que du texte rencontre, donc celui qui fixe le plancher. Un ratio
mesuré sur du blanc pur ne prouve rien — aucun écran n'en affiche.

| Token     | Valeur    | sur `--surface`  | sur `--sunken`   | Usage                 |
| --------- | --------- | ---------------- | ---------------- | --------------------- |
| `--ink`   | `#323859` | 11,2:1           | 9,2:1            | texte principal       |
| `--muted` | `#5d667e` | 5,63:1           | 4,65:1           | tout texte secondaire |
| `--faint` | `#aab2c4` | 2,13:1 — **non textuel**            | filets, pastilles     |

`--muted` porte aussi du texte sur `--tagbg` (4,90:1) et `--ring` (4,84:1) :
les fonds teintés passent dès que `--sunken` passe.

`--faint` ne se pose **jamais** en `color`. Il ne sert qu'à ce qui n'est pas du
texte : séparateurs, pastilles inactives, icônes décoratives.

L'échelle ne peut pas porter trois gris de texte : pour tenir 4,5:1, tous
devraient descendre sous une luminance de 0,18, où ils cessent de se
différencier. Elle en porte donc deux. L'ancien `--hint` (2,54:1) a été
supprimé ; l'ancien `--faint` portait l'historique des idées à **2,13:1**.

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

Les **espacements**, **rayons** et **ombres** viennent de `design/mockup.html`
et n'ont pas bougé. Les surfaces, les couleurs de texte et les tailles, si :
la maquette décrit une interface à trois écrans dans une colonne étroite, et
ne fait plus foi ni sur la mise en page ni sur ces trois familles de tokens.
Voir `docs/interface-design.md`.

## Typographie

**Les tailles sont des tokens.** Cinq, et aucun littéral `font-size` dans le
dépôt :

| Token           | Valeur | Usage                                        |
| --------------- | ------ | -------------------------------------------- |
| `--text-hero`   | `20px` | le texte courant d'une idée, dans le détail  |
| `--text-title`  | `16px` | titres d'écran                               |
| `--text-body`   | `13px` | le texte des idées, les boutons              |
| `--text-sm`     | `12px` | texte secondaire                             |
| `--text-xs`     | `11px` | compteurs, dates, sur-titres                 |

L'échelle est **contrastée** à dessein : elle allait de 11 à 15 px par pas de
1 px, où rien ne ressortait.

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

## Focus clavier

**Tout élément focalisable porte un anneau visible.** Sans exception : une
application qui se parcourt à la tabulation n'a pas le droit d'avoir un arrêt
invisible.

```css
.quelque-chose:focus-visible {
  outline: var(--focus-outline);
  outline-offset: var(--focus-offset);
}
```

- `:focus-visible` pour les **boutons** — il ne se déclenche pas au clic souris,
  ce qui évite de bagueler ce qu'on vient de cliquer.
- `:focus-within` sur le **conteneur** d'un champ de saisie (`.composer`,
  `.editor`, `.search`), jamais sur l'`<input>` lui-même : les deux anneaux se
  superposeraient. L'`<input>` garde son `outline: none`.

**L'anneau est en `--accent` plein, et ce n'est pas un choix esthétique.** WCAG
2.2 exige 3:1 contre les couleurs voisines. Le turquoise plein donne 4,02:1 sur
`--surface` et 3,32:1 sur `--sunken` ; **dès 75 % d'opacité il tombe à 2,79 et
2,45**, sous le seuil. Aucune version adoucie ne passe. L'ancien jeton
`--focus-ring` (un halo pâle de `--ring`) mesurait **1,04:1 sur `--sunken`** :
il figurait dans le CSS et n'existait pas à l'œil.

## Scrollbars

Zones scrollables (liste, composer auto-extensible) : scrollbar fine et discrète
(~8px, coins arrondis), stylée via `::-webkit-scrollbar`. Le détail propre à un
composant — par ex. la **piste de scroll du composer raccourcie en bas** pour
qu'elle s'arrête au-dessus du chevron d'envoi — est colocalisé dans son module.

**Discrète, jamais masquée.** Une barre réduite à `height: 0` supprime le seul
indice qu'il reste du contenu ; ce qui sort du champ disparaît sans trace. Si
une zone est trop étroite pour son contenu, on la fait **revenir à la ligne**
(`flex-wrap`) plutôt que défiler en cachette. Le défilement horizontal se
réserve à ce qu'on ne peut pas replier — un tableau, un bloc de code.

## Hors-périmètre

Pas de thème sombre, pas d'animations élaborées en MVP.
