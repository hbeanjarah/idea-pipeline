# Interface — plan d'implémentation

**But :** faire tenir le panneau à toutes ses largeurs, rendre la reformulation
bon marché, et supprimer la latence perçue que l'hébergement a introduite.

**Approche :** douze tâches en cinq lots. Les fondations d'abord (jetons,
accessibilité) parce que tout s'appuie dessus ; le comportement ensuite
(optimisme, squelettes) parce qu'il ne dépend d'aucune mise en page ; la
structure après (fusion des écrans, maître-détail) ; le cœur produit enfin
(Corriger / Reformuler). Chaque tâche livre quelque chose d'utile seule.

**Pile :** React · TypeScript strict · CSS pur (modules) · vitest ·
Vite + `@crxjs`. **Aucune dépendance ajoutée.**

**Spec :** [`docs/interface-design.md`](./interface-design.md) — le plan
argumente depuis elle, les deux se lisent ensemble.

---

## Contraintes globales

Elles s'appliquent à **toutes** les tâches, sans être répétées.

- **Git : 100 % manuel.** Aucune tâche n'exécute de commande Git. Les étapes
  « commit » ne contiennent qu'un **texte de message proposé** — c'est le PO qui
  commite. (`CLAUDE.md`, `.claude/rules/git.md`.)
- **Aucune installation.** Ni `pnpm add`, ni `pnpm remove`, ni `pnpm update`.
  `@testing-library/react` reste absent : aucune tâche ne teste un composant
  React. (`.claude/rules/dependencies.md`.)
- **Le code livré passe** `pnpm typecheck`, `pnpm lint`, `pnpm format` et
  `pnpm test` sans erreur. Trois avertissements `max-lines` préexistent sur des
  fichiers de test : ils restent, aucun nouveau n'est accepté.
- **Anglais dans le code**, français réservé aux textes vus par l'utilisateur.
  (`.claude/rules/code-style.md`.)
- **Pas de commentaire qui paraphrase le code.** On ne commente qu'un piège
  d'API, une contrainte externe, ou la raison d'un choix qu'un nettoyage
  casserait.
- **Présentation vs données :** un composant de `components/` reçoit tout en
  props et ne touche ni au dépôt ni à `chrome.*`. (`.claude/rules/react.md`.)
- **Aucun changement d'API.** Ni endpoint, ni schéma, ni migration. Aucune
  tâche ne touche `server/`.
- **Rien du hors-scope MVP** ne rentre : pas d'IA, pas d'export, pas de partage,
  pas de hors-ligne, pas de restauration d'ancienne version.

**Exécution.** Le projet avance brique par brique avec validation du PO entre
chaque tâche — c'est sa règle, et elle remplace le mode « un sous-agent par
tâche » que propose la méthode. On s'arrête à la fin de chaque tâche.

---

# Lot A — Les fondations

Quatre tâches courtes, sans risque structurel. Chacune répare un défaut mesuré
et se vérifie à l'œil en une minute.

## Tâche 1 : les jetons

Deux surfaces au lieu de trois, cinq tailles nommées, et toute couleur portant
du texte au-dessus de 4,5:1.

**Fichiers :**

- Modifier : `src/styles/tokens.css`
- Modifier : `src/styles/global.css:20`
- Modifier : les 18 fichiers CSS qui consomment les jetons retirés
  (`grep -rl -- 'var(--bg)\|var(--panel)\|var(--card)\|var(--hint)\|var(--faint)\|font-size:' src/`)

### Ce qui change dans `tokens.css`

- [ ] **Étape 1 : remplacer le bloc « Surfaces & borders »**

`--bg`, `--panel` et `--card` disparaissent. Leurs paliers valaient 1,101:1 et
1,085:1 — sous le seuil où l'œil sépare seul, donc ce sont les bordures qui
portaient la structure.

```css
/* Surfaces — deux niveaux, pas trois. Le palier vaut 1,210:1 (contre 1,085
 * entre l'ancienne carte et son panneau), assez pour se voir sans bordure.
 * Teinte froide ~218° tenue sur les deux : l'ancien --card etait du blanc pur,
 * seule valeur neutre d'une serie froide. */
--sunken: #e2e8f2;
--surface: #fcfdff;
--surfacebd: #d5deec;
```

`--panelbd`, `--cardbd`, `--capbd`, `--ring`, `--spine` restent : ils bordent,
ils ne remplissent pas.

- [ ] **Étape 2 : corriger les couleurs de texte**

```css
/* Text — deux niveaux seulement. Une couleur de texte tient 4,5:1 (WCAG AA) ;
 * l'ancienne echelle a trois gris ne le permettait pas : il faut loger trois
 * valeurs sous une luminance de 0,18, elles deviennent indistinctes.
 * Mesures sur --surface : --ink 11,4:1 · --muted 4,94:1.
 * L'ancien --hint valait 2,54:1 et --faint 2,13:1. */
--ink: #323859;
--muted: #66708a;

/* Non-textuel uniquement : filets, pastilles inactives, separateurs.
 * Ne jamais poser en `color`. */
--faint: #aab2c4;
```

`--hint` est **supprimé** : ses 12 usages sont tous des `color:`.

- [ ] **Étape 3 : ajouter l'échelle typographique**

Les 38 tailles du projet sont des littéraux dispersés dans 16 fichiers, et
progressent par pas de 1 px — rien ne ressort. Cinq jetons, avec le haut
d'échelle qui manquait :

```css
/* Typographie — echelle contrastee. --text-hero n'existait pas : le volet
 * detail n'avait pas de taille pour son texte courant. */
--text-hero: 20px;
--text-title: 16px;
--text-body: 13px;
--text-sm: 12px;
--text-xs: 11px;
```

### Ce qui change dans les modules

- [ ] **Étape 4 : les surfaces**

| Où                                                                                                 | Avant                      | Après                        |
| -------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------- |
| `global.css:20`                                                                                    | `background: var(--bg)`    | `background: var(--sunken)`  |
| `HomeScreen:6`, `ListScreen:10`, `DetailScreen:12`, `SignInScreen:9`                               | `background: var(--panel)` | `background: var(--sunken)`  |
| `IdeaCard:9`, `SearchInput:10`, `Composer:7`, `VariationEditor:6`, `Popover:29`, `SignInScreen:42` | `background: var(--card)`  | `background: var(--surface)` |
| `Avatar:17`, `IdeaHeader:70`                                                                       | `color: var(--card)`       | `color: var(--surface)`      |

**Attention :** `Avatar:17` et `IdeaHeader:70` posent le jeton en `color:` — du
texte clair sur un fond coloré. Ce sont les deux seuls cas ; ne pas les traiter
comme des fonds.

- [ ] **Étape 5 : retirer les bordures devenues fausses**

`--panel` et `--bg` valent désormais la même chose. Un conteneur qui garde sa
bordure ressemble alors à une boîte vide dessinée sur le vide. Retirer
`border` **et** `border-radius` sur :

- `src/screens/HomeScreen.module.css:7`
- `src/screens/SignInScreen.module.css:10`

`ListScreen` et `DetailScreen` n'en ont pas.

- [ ] **Étape 6 : les couleurs de texte**

`var(--hint)` → `var(--muted)` aux **12** emplacements, tous des `color:` :

```
IdeaCard:68 · SignInScreen:32 · HomeScreen:75,83,116 · DetailScreen:44
AccountMenu:34 · SearchInput:13,18,33 · Composer:39 · VariationThread:56
```

`var(--faint)` → `var(--muted)` aux **4** emplacements qui portent du texte :

```
StatusFilter:43 · SignInScreen:83 · HomeScreen:128 · VariationThread:31
```

Les **4** autres usages de `--faint` sont des `background:` — des filets et des
pastilles. **Ne pas y toucher** :

```
VariationEditor:45 · ListScreen:61 · DetailScreen:32 · Composer:53
```

- [ ] **Étape 7 : les tailles**

Remplacer chaque littéral `font-size` par son jeton : `15px` et `14px` →
`var(--text-title)`, `13px` → `var(--text-body)`, `12px` → `var(--text-sm)`,
`11px` → `var(--text-xs)`. `--text-hero` n'a pas encore de consommateur : il
arrive en tâche 11.

- [ ] **Étape 8 : vérifier**

```bash
pnpm typecheck && pnpm lint && pnpm test
grep -rn -- "var(--bg)\|var(--panel)\|var(--card)\|var(--hint)" src/
```

Attendu : tout vert, et le `grep` **sans aucun résultat**. S'il en reste un, un
jeton est référencé sans exister — la règle CSS sera silencieusement ignorée,
ce qui ne casse rien et ne se voit pas. C'est exactement pour ça qu'on le
cherche.

Puis `pnpm build`, recharger l'extension, ouvrir le panneau : l'ensemble doit
paraître **un peu plus net et un peu moins bleuté**, sans qu'aucun élément ait
bougé.

- [ ] **Étape 9 : commit**

```
refactor(ui): collapse the surfaces and make text readable

Three near-identical surfaces separated by 1.08:1 left the borders
doing all the structural work, and the card was the only pure-neutral
value in a cool series. Two surfaces now, one visible step apart.

Two of the three text greys were below WCAG AA — the version history
sat at 2.13:1. The scale cannot hold three greys above 4.5:1, so it
holds two.

Names the five font sizes that were 38 literals across 15 files.
```

---

## Tâche 2 : le focus clavier

`grep -rn "focus-visible" src/` renvoie **2** résultats sur une douzaine
d'éléments focalisables. Au clavier, l'application est aveugle.

**Fichiers :** `IdeaCard`, `StatusFilter`, `Popover`, `ActionMenu`,
`StatusPicker`, `IdeaHeader`, `SearchInput`, `ListScreen` — leurs modules CSS.

- [ ] **Étape 1 : mesurer l'existant**

```bash
grep -rn "focus-visible" src/
```

Attendu : exactement deux lignes — `SignInScreen.module.css:56` et
`Alert.module.css:53`. C'est la base de départ, à comparer en fin de tâche.

- [ ] **Étape 2 : réparer le champ de recherche**

`SearchInput.module.css:26` porte `outline: none` **sans rien mettre à la
place** : le champ ne montre jamais qu'il est actif. Le conteneur prend le
relais, comme `Composer` et `VariationEditor` le font déjà :

```css
.search:focus-within {
  box-shadow: var(--focus-ring);
}
```

Garder `outline: none` sur `.input` — c'est le conteneur qui porte l'anneau,
sinon les deux se superposent.

- [ ] **Étape 3 : l'anneau sur tout ce qui se focalise**

Le jeton existe déjà (`tokens.css:64`). Ajouter à chaque module :

```css
.card:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

En adaptant le sélecteur : `.card` (`IdeaCard`), `.pill` (`StatusFilter`),
`.trigger` (`Popover`), `.back` / `.confirm-cancel` / `.confirm-delete`
(`IdeaHeader`), `.status-option` (`StatusPicker`), `.back` (`ListScreen`).

`ActionMenu` passe par le `.trigger` de `Popover` : rien de propre à lui.

- [ ] **Étape 4 : vérifier**

```bash
pnpm lint && pnpm build
```

Recharger l'extension, cliquer une fois dans le panneau, puis **ne plus toucher
la souris** : parcourir toute l'interface à la tabulation. À chaque arrêt,
l'élément focalisé doit être visible. Traverser aussi le champ de recherche.

Attendu : aucun arrêt invisible. C'est le seul test possible — l'anneau dépend
de `:focus-visible`, que seul un vrai navigateur décide.

- [ ] **Étape 5 : commit**

```
fix(a11y): show keyboard focus across the panel

Only two of a dozen focusable elements had a focus style, and the
search field removed its outline without replacing it. The tool claims
to be keyboard-reachable; it was invisible.
```

---

## Tâche 3 : les filtres reviennent à la ligne

`StatusFilter` défile horizontalement avec sa barre masquée. Dans la colonne de
306 px qu'introduit la tâche 10, « Prêt » et « Publié » sortent du champ et rien
ne l'indique.

**Fichier :** `src/components/StatusFilter/StatusFilter.module.css:5-14`

- [ ] **Étape 1 : constater le défaut**

Dans le panneau, réduire la largeur jusqu'à ~320 px. Les cinq puces se coupent
à droite, sans indice. C'est ce qu'on répare.

- [ ] **Étape 2 : remplacer le défilement par le retour à la ligne**

```css
.filters {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin: 0 0 var(--space-3);
}
```

Retirer `overflow-x: auto`, `padding-bottom: 3px` et le bloc
`.filters::-webkit-scrollbar`, qui n'ont plus d'objet. Garder `flex: none` sur
`.pill` : sans lui les puces se compressent au lieu de passer à la ligne.

- [ ] **Étape 3 : corriger le commentaire d'en-tête**

Il dit « Horizontally scrollable, scrollbar hidden — like the mockup. » Ce
n'est plus vrai, et `.claude/rules/code-style.md` interdit les références
mortes. Le remplacer par :

```css
/* Retour a la ligne plutot que defilement horizontal : la barre etait masquee,
 * donc les etapes hors champ n'avaient aucun indice. */
```

- [ ] **Étape 4 : vérifier**

`pnpm build`, recharger, réduire le panneau à ~320 px. Les cinq étapes et leurs
compteurs sont visibles sur deux lignes, aucune coupure.

- [ ] **Étape 5 : commit**

```
fix(list): wrap the status filters instead of hiding them

The bar scrolled horizontally with its scrollbar suppressed, so the
last two stages simply vanished at narrow widths with nothing to say
they existed.
```

---

## Tâche 4 : l'écran de connexion se borne

`.sign-in` n'a aucune largeur maximale et `.button` porte `width: 100%` : à
960 px, le bouton Google mesure 960 px pour 190 px de texte. C'est le premier
écran qu'on voit.

**Fichier :** `src/screens/SignInScreen.module.css`

- [ ] **Étape 1 : borner et centrer**

```css
.sign-in {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Le panneau va de ~320 a ~1000 px. Sans borne, le bouton suit la fenetre. */
  max-width: 380px;
  margin: 0 auto;
  padding: 34px var(--space-3) 28px;
  background: var(--sunken);
  text-align: center;
}
```

- [ ] **Étape 2 : vérifier**

`pnpm build`, recharger, se déconnecter. Élargir et rétrécir le panneau de bout
en bout : le bloc reste centré et ne dépasse jamais 380 px. À 320 px, il occupe
toute la largeur sans déborder.

- [ ] **Étape 3 : commit**

```
fix(auth): stop the sign-in block from following the panel width

The Google button stretched to the full panel — 960px of button for
190px of text on the first screen anyone sees.
```

---

# Lot B — Ce que l'application dit, et quand elle le dit

Quatre tâches qui ne dépendent d'aucune mise en page. Les deux premières
corrigent ce que la carte raconte — une étape sans nom, et le mauvais texte ;
les deux suivantes corrigent le moment où l'écran le raconte. À la fin,
l'application paraît instantanée et ne ment plus sur ce qu'elle affiche.

## Tâche 5 : le libellé de statut, en un seul endroit

Sur la carte, le statut n'est qu'une pastille de couleur posée seule sous le
texte — sans nom. C'est très lisible à 340 px et orphelin à 960. La carte
« confort » retenue par le PO porte la pastille **et** son libellé.

Et les libellés français existent en **trois copies** : `StatusPicker` (`LABELS`),
`StatusFilter` (`SEGMENTS`), `HomeScreen` (`PIPELINE_SEGMENTS`). Leurs propres
commentaires avouent le couplage — « Same status keeps the same label everywhere
(cf. Home pipeline) », « kept in sync with the rest of the app ». En ajouter une
quatrième dans `IdeaCard` serait la copie de trop : `.claude/rules/react.md`
demande de factoriser au **2ᵉ** cas réel, on en est au troisième.

**Fichiers :**

- Créer : `src/lib/statusLabels.ts`
- Créer : `test/statusLabels.test.ts`
- Modifier : `src/components/IdeaCard/IdeaCard.tsx` et son module CSS
- Modifier : `src/components/StatusPicker/StatusPicker.tsx:7-18`
- Modifier : `src/components/StatusFilter/StatusFilter.tsx:10-17`
- Modifier : `src/screens/HomeScreen.tsx:18-23`

**Interfaces produites :**

```ts
STATUS_LABELS: Record<Status, string>;
STATUS_ORDER: Status[];
```

- [ ] **Étape 1 : écrire le test qui échoue**

`test/statusLabels.test.ts` :

```ts
import { describe, expect, it } from 'vitest';

import { STATUS_LABELS, STATUS_ORDER } from '@/lib/statusLabels';
import type { Status } from '@/storage/types';

// Ecrit a la main plutot que derive de STATUS_ORDER : un test qui se compare
// a lui-meme passerait meme si une etape disparaissait.
const EVERY_STATUS: Status[] = [
  'captured',
  'maturing',
  'ready',
  'published',
];

describe('the status labels', () => {
  it('names every stage of the pipeline', () => {
    for (const status of EVERY_STATUS) {
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('lists every stage exactly once, in pipeline order', () => {
    expect(STATUS_ORDER).toEqual(EVERY_STATUS);
  });
});
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
pnpm test statusLabels
```

Attendu : échec sur la résolution de `@/lib/statusLabels`.

- [ ] **Étape 3 : écrire le module**

`src/lib/statusLabels.ts` :

```ts
import type { Status } from '@/storage/types';

// Les seuls libellés français des étapes. Trois copies vivaient auparavant dans
// StatusPicker, StatusFilter et HomeScreen, chacune priée de rester synchrone
// des deux autres à la main.
export const STATUS_LABELS: Record<Status, string> = {
  captured: 'Capturé',
  maturing: 'Maturation',
  ready: 'Prêt',
  published: 'Publié',
};

// Ordre du pipeline. Les transitions restent libres : toute étape est
// atteignable depuis toute étape.
export const STATUS_ORDER: Status[] = [
  'captured',
  'maturing',
  'ready',
  'published',
];
```

`Record<Status, string>` est ce qui fait le travail : ajouter une cinquième
étape au domaine casserait la compilation ici, au lieu de laisser un libellé
manquant apparaître à l'écran.

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
pnpm test statusLabels
```

Attendu : 2 tests verts.

- [ ] **Étape 5 : remplacer les trois copies**

- `StatusPicker.tsx` — supprimer `LABELS` et `ORDER`, importer `STATUS_LABELS`
  et `STATUS_ORDER`. Leurs commentaires « Provisional labels, kept in sync with
  the rest of the app » et « Pipeline order » décrivent le module qu'on vient
  d'écrire : ils partent avec le code.
- `StatusFilter.tsx` — `SEGMENTS` garde son entrée `'all'` (qui n'est pas un
  `Status` mais un `FilterStatus`) et dérive les quatre autres :

```tsx
const SEGMENTS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Tous' },
  ...STATUS_ORDER.map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  })),
];
```

- `HomeScreen.tsx` — même dérivation pour `PIPELINE_SEGMENTS`, qui exclut
  `'published'`. L'écran disparaît en tâche 9 ; le convertir coûte une ligne et
  garde la vérification de l'étape 7 honnête d'ici là.

- [ ] **Étape 6 : donner son libellé à la carte**

`IdeaCard.tsx`, le bloc `meta` :

```tsx
<span className={styles.meta}>
  <span className={`${styles.dot} ${styles[idea.status]}`} />
  {STATUS_LABELS[idea.status]}
  {versionCount > 1 && (
    <span className={styles.versions}>{versionCount} versions</span>
  )}
</span>
```

Le `·` qui précédait le compteur disparaît : il séparait deux éléments collés,
et le compteur part maintenant à droite. Dans le module CSS :

```css
.versions {
  margin-left: auto;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Étape 7 : vérifier**

```bash
pnpm typecheck && pnpm lint && pnpm test
grep -rn "'Capturé'\|'Maturation'\|'Prêt'\|'Publié'" src/
```

Attendu : tout vert, et le `grep` ne renvoyant plus que `src/lib/statusLabels.ts`.

Puis `pnpm build`, recharger : chaque carte annonce son étape en toutes lettres,
et le compteur de versions est à droite sur la même ligne.

- [ ] **Étape 8 : commit**

```
refactor(ui): name the pipeline stages in one place

The four French labels lived in three copies, each commented with a
reminder to keep it in sync with the other two by hand. The card was
about to become a fourth.

A card now spells out its stage instead of showing a bare dot with no
name — legible at 340px, orphaned at 960.
```

---

## Tâche 6 : la carte lit la dernière variation

`IdeaCard.tsx:11` lit `idea.variations[0]` — la version **d'origine**. Une idée
reformulée trois fois montre toujours son premier jet. Personne ne l'a vu parce
que personne n'a jamais reformulé.

**Fichiers :**

- Créer : `src/lib/variations.ts`
- Créer : `test/variations.test.ts`
- Modifier : `src/components/IdeaCard/IdeaCard.tsx:11-12`

**Interfaces produites :**

```ts
currentVariation(idea: Idea): Variation;
previousVariations(idea: Idea): Variation[];
```

La tâche 11 s'appuie sur les deux.

- [ ] **Étape 1 : écrire le test qui échoue**

`test/variations.test.ts` :

```ts
import { describe, expect, it } from 'vitest';

import {
  currentVariation,
  previousVariations,
} from '@/lib/variations';
import type { Idea } from '@/storage/types';

const ideaWith = (...texts: string[]): Idea => ({
  id: 'i1',
  status: 'captured',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  variations: texts.map((text, index) => ({
    id: `v${index + 1}`,
    text,
    createdAt: `2026-01-0${index + 1}T00:00:00.000Z`,
  })),
});

describe('the current variation', () => {
  it('is the last one, not the first', () => {
    const idea = ideaWith('premier jet', 'deuxième', 'troisième');
    expect(currentVariation(idea).text).toBe('troisième');
  });

  it('is the only one when there is just one', () => {
    expect(currentVariation(ideaWith('seule')).text).toBe('seule');
  });
});

describe('the previous variations', () => {
  it('are everything but the last, oldest first', () => {
    const idea = ideaWith('a', 'b', 'c');
    expect(previousVariations(idea).map((v) => v.text)).toEqual([
      'a',
      'b',
    ]);
  });

  it('are empty when the idea has never been reformulated', () => {
    expect(previousVariations(ideaWith('seule'))).toEqual([]);
  });
});
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
pnpm test variations
```

Attendu : échec sur la résolution de `@/lib/variations` — le module n'existe
pas.

- [ ] **Étape 3 : écrire l'implémentation minimale**

`src/lib/variations.ts` :

```ts
import type { Idea, Variation } from '@/storage/types';

// variations est garanti >= 1 par le domaine (storage.md) : la capture initiale
// en cree toujours une. L'assertion non-null tient a cette garantie.
export function currentVariation(idea: Idea): Variation {
  return idea.variations[idea.variations.length - 1]!;
}

export function previousVariations(idea: Idea): Variation[] {
  return idea.variations.slice(0, -1);
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
pnpm test variations
```

Attendu : 4 tests verts.

- [ ] **Étape 5 : brancher la carte**

`src/components/IdeaCard/IdeaCard.tsx`, remplacer les lignes 10-12 :

```tsx
// La derniere variation fait foi : c'est elle le texte courant de l'idee.
const text = currentVariation(idea).text;
const versionCount = idea.variations.length;
```

et ajouter l'import `import { currentVariation } from '@/lib/variations';`.

Supprimer le commentaire « Shows the original (first) variation as a preview »
en tête de composant : il décrit le défaut qu'on retire.

- [ ] **Étape 6 : vérifier**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Puis `pnpm build`, recharger. Ouvrir une idée, ajouter une reformulation,
revenir à la liste : **la carte doit afficher le nouveau texte**. Avant ce
correctif, elle affichait l'ancien.

- [ ] **Étape 7 : commit**

```
fix(list): show the current variation on a card, not the first

A card read variations[0], so an idea reformulated three times still
advertised its first draft. Invisible until now because nothing had
ever been reformulated.
```

---

## Tâche 7 : l'affichage optimiste

`IdeasProvider.create` attend la réponse avant d'afficher. Depuis que l'API est
à Strasbourg, chaque ⏎ laisse l'écran immobile le temps d'un aller-retour.

**Fichiers :**

- Créer : `src/lib/optimistic.ts`
- Créer : `test/optimistic.test.ts`
- Modifier : `src/hooks/IdeasProvider.tsx`
- Modifier : `src/hooks/useIdeas.ts`
- Modifier : `src/components/Composer/Composer.tsx`
- Modifier : `src/components/IdeaCard/IdeaCard.module.css`

**Interfaces produites :**

```ts
interface OptimisticState {
  ideas: Idea[];
  pendingIds: ReadonlySet<string>;
}
provisionalIdea(text: string, id: string, now: string): Idea;
withProvisional(state: OptimisticState, idea: Idea): OptimisticState;
confirmProvisional(state, provisionalId: string, confirmed: Idea): OptimisticState;
dropProvisional(state, provisionalId: string): OptimisticState;
restoreAt(ideas: Idea[], index: number, idea: Idea): Idea[];
```

`useIdeas` expose en plus `pendingIds: ReadonlySet<string>`, que la tâche 10
consomme.

- [ ] **Étape 1 : écrire les tests qui échouent**

`test/optimistic.test.ts` :

```ts
import { describe, expect, it } from 'vitest';

import {
  confirmProvisional,
  dropProvisional,
  provisionalIdea,
  withProvisional,
} from '@/lib/optimistic';
import type { Idea } from '@/storage/types';

const NOW = '2026-09-17T10:00:00.000Z';

const existing: Idea = {
  id: 'server-1',
  status: 'maturing',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  variations: [
    {
      id: 'v1',
      text: 'déjà là',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ],
};

const empty = { ideas: [existing], pendingIds: new Set<string>() };

describe('a provisional idea', () => {
  it('looks like what the server will send back', () => {
    const idea = provisionalIdea('une idée', 'tmp-1', NOW);

    expect(idea.id).toBe('tmp-1');
    expect(idea.status).toBe('captured');
    expect(idea.createdAt).toBe(NOW);
    expect(idea.updatedAt).toBe(NOW);
    expect(idea.variations).toHaveLength(1);
    expect(idea.variations[0].text).toBe('une idée');
  });
});

describe('adding a provisional idea', () => {
  it('appends it and marks it pending', () => {
    const next = withProvisional(
      empty,
      provisionalIdea('une idée', 'tmp-1', NOW),
    );

    expect(next.ideas.map((i) => i.id)).toEqual([
      'server-1',
      'tmp-1',
    ]);
    expect(next.pendingIds.has('tmp-1')).toBe(true);
  });

  it('leaves the previous state untouched', () => {
    withProvisional(empty, provisionalIdea('x', 'tmp-1', NOW));

    expect(empty.ideas).toHaveLength(1);
    expect(empty.pendingIds.size).toBe(0);
  });
});

describe('confirming a provisional idea', () => {
  const confirmed: Idea = { ...existing, id: 'server-2' };

  it('swaps it in place and clears the pending mark', () => {
    const pending = withProvisional(
      empty,
      provisionalIdea('une idée', 'tmp-1', NOW),
    );
    const next = confirmProvisional(pending, 'tmp-1', confirmed);

    expect(next.ideas.map((i) => i.id)).toEqual([
      'server-1',
      'server-2',
    ]);
    expect(next.pendingIds.size).toBe(0);
  });

  it('does nothing when the provisional idea is already gone', () => {
    const next = confirmProvisional(empty, 'tmp-1', confirmed);

    expect(next.ideas.map((i) => i.id)).toEqual(['server-1']);
  });
});

describe('dropping a provisional idea', () => {
  it('removes it and clears the pending mark', () => {
    const pending = withProvisional(
      empty,
      provisionalIdea('une idée', 'tmp-1', NOW),
    );
    const next = dropProvisional(pending, 'tmp-1');

    expect(next.ideas.map((i) => i.id)).toEqual(['server-1']);
    expect(next.pendingIds.size).toBe(0);
  });

  it('never removes a confirmed idea', () => {
    const next = dropProvisional(empty, 'server-1');

    expect(next.ideas.map((i) => i.id)).toEqual(['server-1']);
  });
});
```

Le dernier cas compte : `dropProvisional` ne doit retirer que ce qui est en
attente. Sans cette garde, un identifiant mal transmis effacerait une vraie
idée de l'écran.

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
pnpm test optimistic
```

Attendu : échec sur la résolution de `@/lib/optimistic`.

- [ ] **Étape 3 : écrire l'implémentation**

`src/lib/optimistic.ts` :

```ts
import type { Idea } from '@/storage/types';

export interface OptimisticState {
  ideas: Idea[];
  pendingIds: ReadonlySet<string>;
}

// Le panneau fabrique ici ce que le serveur produira : statut initial et dates.
// C'est une duplication assumee d'une regle serveur (voir interface-design.md),
// qui ne vit que le temps d'un aller-retour.
export function provisionalIdea(
  text: string,
  id: string,
  now: string,
): Idea {
  return {
    id,
    status: 'captured',
    createdAt: now,
    updatedAt: now,
    variations: [{ id: `${id}-v1`, text, createdAt: now }],
  };
}

const without = (
  pendingIds: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> => {
  const next = new Set(pendingIds);
  next.delete(id);
  return next;
};

export function withProvisional(
  state: OptimisticState,
  idea: Idea,
): OptimisticState {
  return {
    ideas: [...state.ideas, idea],
    pendingIds: new Set(state.pendingIds).add(idea.id),
  };
}

export function confirmProvisional(
  state: OptimisticState,
  provisionalId: string,
  confirmed: Idea,
): OptimisticState {
  if (!state.pendingIds.has(provisionalId)) return state;

  return {
    ideas: state.ideas.map((idea) =>
      idea.id === provisionalId ? confirmed : idea,
    ),
    pendingIds: without(state.pendingIds, provisionalId),
  };
}

// Ne retire que ce qui est en attente : une idee confirmee n'est jamais la
// victime d'un identifiant errone.
export function dropProvisional(
  state: OptimisticState,
  provisionalId: string,
): OptimisticState {
  if (!state.pendingIds.has(provisionalId)) return state;

  return {
    ideas: state.ideas.filter((idea) => idea.id !== provisionalId),
    pendingIds: without(state.pendingIds, provisionalId),
  };
}
```

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
pnpm test optimistic
```

Attendu : 7 tests verts. (Les deux de `restoreAt` arrivent à l’étape 7.)

- [ ] **Étape 5 : faire de l'état du fournisseur un seul objet**

`IdeasProvider` tient aujourd'hui `ideas` seul. Les identifiants en attente
doivent varier **avec** lui : deux `useState` séparés se désynchronisent dès
qu'une réponse arrive pendant qu'une autre part. Un seul état, et les fonctions
pures de l'étape 3 font tout le travail — c'est ce qui donne du sens à leurs
tests.

```tsx
const [state, setState] = useState<OptimisticState>({
  ideas: [],
  pendingIds: new Set(),
});
```

Remplacer mécaniquement les usages existants :

| Avant                                      | Après                                                 |
| ------------------------------------------ | ----------------------------------------------------- |
| `setIdeas(await ideaRepository.list())`    | `setState({ ideas: await …, pendingIds: new Set() })` |
| `setIdeas((current) => …)` dans `replace`  | `setState((s) => ({ ...s, ideas: … }))`               |
| `setIdeas((current) => current.filter(…))` | `setState((s) => ({ ...s, ideas: … }))`               |
| `ideas` dans la valeur du contexte         | `state.ideas`                                         |

Un rechargement complet (`reload`) vide `pendingIds` : ce que le serveur renvoie
est confirmé par définition.

- [ ] **Étape 6 : réécrire `create`**

```tsx
const create = useCallback(async (text: string) => {
  // L'identifiant provisoire ne quitte jamais le panneau : il est remplace
  // par celui du serveur des la reponse.
  const provisional = provisionalIdea(
    text,
    crypto.randomUUID(),
    new Date().toISOString(),
  );

  setState((current) => withProvisional(current, provisional));

  try {
    const idea = await ideaRepository.create(text);
    setState((current) =>
      confirmProvisional(current, provisional.id, idea),
    );
    return idea;
  } catch (error) {
    setState((current) => dropProvisional(current, provisional.id));
    throw error;
  }
}, []);
```

Le tableau de dépendances est vide, et c'est correct : `setState` reçoit une
fonction, donc rien de l'état courant n'est capturé.

Exposer `pendingIds` dans la valeur du contexte, l'ajouter au `useMemo` de
dépendances, et à `IdeasContextValue` dans `src/hooks/useIdeas.ts` :

```ts
pendingIds: ReadonlySet<string>;
```

- [ ] **Étape 7 : le même traitement pour le statut et la suppression**

La spec les demande aussi, et le mécanisme diffère : il n'y a pas d'idée
provisoire à retirer, mais une valeur antérieure à **rétablir**.

Écrire d'abord le test, dans `test/optimistic.test.ts` — en ajoutant `restoreAt`
à l'import en tête de fichier :

```ts
describe('restoring an idea at its place', () => {
  it('puts it back where it was, not at the end', () => {
    const second: Idea = { ...existing, id: 'server-2' };
    const third: Idea = { ...existing, id: 'server-3' };
    const ideas = [existing, second, third];

    expect(
      restoreAt(
        ideas.filter((i) => i.id !== 'server-2'),
        1,
        second,
      ).map((i) => i.id),
    ).toEqual(['server-1', 'server-2', 'server-3']);
  });

  it('appends when the index is past the end', () => {
    expect(
      restoreAt([existing], 9, existing).map((i) => i.id),
    ).toEqual(['server-1', 'server-1']);
  });
});
```

Puis l'ajouter à `src/lib/optimistic.ts` :

```ts
// Une suppression annulee doit revenir a sa place : la liste est triee par le
// consommateur, mais un retour en fin de tableau se verrait le temps d'un rendu.
export function restoreAt(
  ideas: Idea[],
  index: number,
  idea: Idea,
): Idea[] {
  const next = [...ideas];
  next.splice(index, 0, idea);
  return next;
}
```

`changeStatus` applique le changement avant l'appel et rétablit l'idée
antérieure si le serveur refuse :

```tsx
const changeStatus = useCallback(
  (ideaId: string, status: Status) =>
    attempt(async () => {
      let before: Idea | undefined;

      setState((current) => {
        before = current.ideas.find((item) => item.id === ideaId);
        return {
          ...current,
          ideas: current.ideas.map((item) =>
            item.id === ideaId ? { ...item, status } : item,
          ),
        };
      });

      try {
        const idea = await ideaRepository.changeStatus(
          ideaId,
          status,
        );
        setState((current) => ({
          ...current,
          ideas: current.ideas.map((item) =>
            item.id === ideaId ? idea : item,
          ),
        }));
        return idea;
      } catch (error) {
        const restored = before;
        if (restored) {
          setState((current) => ({
            ...current,
            ideas: current.ideas.map((item) =>
              item.id === ideaId ? restored : item,
            ),
          }));
        }
        throw error;
      }
    }),
  [attempt],
);
```

`deleteIdea` retire la carte tout de suite et la remet à son index si l'appel
échoue :

```tsx
const deleteIdea = useCallback(
  (ideaId: string) =>
    attempt(async () => {
      let removed: Idea | undefined;
      let index = -1;

      setState((current) => {
        index = current.ideas.findIndex((item) => item.id === ideaId);
        removed = current.ideas[index];
        return {
          ...current,
          ideas: current.ideas.filter((item) => item.id !== ideaId),
        };
      });

      try {
        await ideaRepository.delete(ideaId);
      } catch (error) {
        const back = removed;
        if (back) {
          setState((current) => ({
            ...current,
            ideas: restoreAt(current.ideas, index, back),
          }));
        }
        throw error;
      }
    }),
  [attempt],
);
```

**Attention au piège :** `DetailScreen.remove` navigue seulement une fois la
suppression confirmée — c'est délibéré, et ça le reste. La carte disparaît de la
liste tout de suite, mais l'écran ne se quitte qu'au retour du serveur. Si
l'appel échoue, on n'a donc ni quitté l'écran, ni perdu l'idée.

- [ ] **Étape 8 : vider le champ tout de suite**

`src/components/Composer/Composer.tsx` — le texte est vidé **avant** l'appel, et
restitué si l'appel échoue :

```tsx
const submit = async () => {
  const trimmed = text.trim();
  if (!trimmed || busy) return;

  setBusy(true);
  // Vide immediatement : la carte apparait deja, garder le texte l'afficherait
  // deux fois. Il est restitue plus bas si l'ecriture echoue.
  setText('');
  try {
    await onSubmit(trimmed);
    setFailure(null);
  } catch (error) {
    setText(trimmed);
    setFailure(failureOf(error));
  } finally {
    setBusy(false);
  }
};
```

Remplacer le commentaire de l'ancien `setText('')` — il disait « Cleared only
once the write is confirmed » — par celui ci-dessus. La garantie d'origine tient
toujours : une idée tapée n'est jamais perdue par une panne.

- [ ] **Étape 9 : marquer visuellement l'attente**

`src/components/IdeaCard/IdeaCard.module.css` :

```css
/* En attente de confirmation du serveur : l'idee est affichee mais n'existe
 * pas encore cote API. */
.pending {
  opacity: 0.5;
}
```

`IdeaCard.tsx` reçoit une prop `pending?: boolean` et l'ajoute à `className`.
Les appelants la passent via `pendingIds.has(idea.id)`.

- [ ] **Étape 10 : vérifier**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Puis, extension rechargée :

1. **Le cas nominal.** Taper une idée, valider. La carte apparaît
   **immédiatement**, estompée, puis devient pleine. Le champ est vide dès la
   validation.
2. **Le cas d'échec, provoqué.** Couper le réseau (mode avion, ou bloquer le
   domaine), taper une idée, valider. La carte apparaît, puis **disparaît**, le
   texte **revient dans le champ**, et l'alerte « Réessayer » s'affiche.
   Rétablir le réseau, cliquer « Réessayer » : l'idée s'enregistre.
3. **Le statut, réseau coupé.** Ouvrir une idée, changer d'étape. La pastille
   change **immédiatement**, puis **revient** à l'étape précédente avec une
   alerte.
4. **La suppression, réseau coupé.** Supprimer une idée depuis le détail. La
   carte disparaît de la liste, puis **revient à sa place** — pas en fin de
   liste — et l'écran de détail n'a pas été quitté.

Les trois derniers sont les seuls qui comptent. Un affichage optimiste qui ne
sait pas se rétracter est un mensonge.

- [ ] **Étape 11 : commit**

```
feat(ui): apply writes locally before the server confirms them

Every write awaited its round trip before rendering anything. Harmless
when storage answered in 2ms; since the API moved to a VPS, Enter left
the panel motionless for the length of a request, and so did changing
a status or deleting an idea.

Each now applies at once and is rolled back if the call fails: a new
idea is withdrawn and its text restored to the field, a status returns
to its previous value, a deleted idea comes back at its own index.
```

---

## Tâche 8 : les squelettes

Les écrans écrivent `{!loading && …}` : tant que la liste n'est pas revenue,
rien n'est rendu. Ouvrir le panneau montre une surface vide.

**Fichiers :**

- Créer : `src/components/CardSkeleton/CardSkeleton.tsx`
- Créer : `src/components/CardSkeleton/CardSkeleton.module.css`
- Modifier : `src/screens/ListScreen.tsx:93`

- [ ] **Étape 1 : le composant**

`src/components/CardSkeleton/CardSkeleton.tsx` :

```tsx
import styles from './CardSkeleton.module.css';

interface Props {
  count: number;
}

// Purement decoratif : aria-hidden pour qu'un lecteur d'ecran n'annonce pas
// des formes vides en attendant les vraies cartes.
export default function CardSkeleton({ count }: Props) {
  return (
    <div className={styles.skeletons} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.card}>
          <span className={styles.line} />
          <span className={styles.meta} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Étape 2 : les styles**

`CardSkeleton.module.css` :

```css
.skeletons {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.card {
  background: var(--surface);
  border: 1px solid var(--cardbd);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}

.line,
.meta {
  display: block;
  border-radius: var(--radius-xs);
  background: var(--cardbd);
  animation: pulse 1.4s ease-in-out infinite;
}

.line {
  height: 11px;
  width: 78%;
}

.meta {
  height: 8px;
  width: 34%;
  margin-top: 9px;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

/* Une pulsation continue est exactement ce que ce reglage systeme demande
 * d'arreter. La forme reste, le mouvement part. */
@media (prefers-reduced-motion: reduce) {
  .line,
  .meta {
    animation: none;
  }
}
```

- [ ] **Étape 3 : l'afficher pendant le chargement**

`ListScreen.tsx` — remplacer le `{!loading && (` de la ligne 93 par un rendu
qui couvre les deux cas :

```tsx
{
  loading ? (
    <div className={styles.rows}>
      <CardSkeleton count={4} />
    </div>
  ) : (
    <div className={styles.rows}>{/* … le contenu existant … */}</div>
  );
}
```

- [ ] **Étape 4 : vérifier**

`pnpm typecheck && pnpm lint && pnpm test`, puis `pnpm build`.

Pour voir les squelettes plus d'un battement de cil, couper le serveur de
production n'aide pas — l'appel échouerait au lieu de traîner. Utiliser plutôt
la limitation de débit de l'onglet DevTools du panneau (`Network` → `Slow 3G`),
puis rouvrir le panneau : quatre cartes grises pulsent avant les vraies.

Vérifier aussi avec le réglage système « réduire les animations » actif : les
formes restent, la pulsation s'arrête.

- [ ] **Étape 5 : commit**

```
feat(ui): show skeleton cards while the list loads

Every screen rendered nothing at all until the list came back. Local
storage made that invisible; a hosted API does not.
```

---

# Lot C — La structure

## Tâche 9 : fusionner l'accueil et la liste

La colonne de gauche contient déjà tout ce que l'accueil offrait. Trois écrans
deviennent deux, et `Route` cesse de désigner une destination.

**Fichiers :**

- Modifier : `src/routes/routes.ts`
- Modifier : `src/sidepanel/App.tsx`
- Modifier : `src/screens/ListScreen.tsx` et son module CSS
- Supprimer : `src/screens/HomeScreen.tsx`, `src/screens/HomeScreen.module.css`

**Interfaces produites :** `Route = { selectedId: string | null }`. La tâche 10
s'appuie dessus.

- [ ] **Étape 1 : le nouveau type de route**

`src/routes/routes.ts` :

```ts
// Ou l'on est (pas de routeur : le Side Panel n'a ni URL ni lien profond).
// Une seule idee peut etre ouverte a la fois ; null veut dire aucune.
export type Route = { selectedId: string | null };

export type Navigate = (route: Route) => void;
```

- [ ] **Étape 2 : déplacer le composeur dans la liste**

`ListScreen.tsx` reçoit en haut ce que `HomeScreen` portait : le titre, le
`AccountMenu`, le `Composer` avec `autoFocus`, et l'indication clavier. La barre
de retour disparaît — il n'y a plus d'accueil où revenir.

L'ordre dans la colonne : titre + compte · composeur · indication · recherche ·
filtres · cartes.

`ListScreen` lit donc désormais `useSession` en plus de `useIdeas`.
`.claude/rules/react.md` l'autorise pour un écran, et note que `HomeScreen` en
était le seul cas — c'est maintenant `ListScreen`, la règle sera mise à jour en
tâche 12.

- [ ] **Étape 3 : ce qui disparaît**

- `PREVIEW_LIMIT` et l'aperçu borné à cinq cartes ;
- le bouton « Toutes mes idées » et son compteur (`.more`, `.more-count`) ;
- `PIPELINE_SEGMENTS` et le mini-pipeline (`.pipe`, `.seg`) — ses compteurs
  vivent déjà dans les puces de `StatusFilter` ;
- la barre de retour de `ListScreen` (`.bar`, `.back`) ;
- les deux fichiers `HomeScreen.*`.

Reprendre l'état vide de `HomeScreen` (« Ta première idée commence ici. » avec
sa flèche) : il est plus juste que celui de `ListScreen` (« Aucune idée pour
l'instant. ») quand le compte est vraiment vide. Garder celui de `ListScreen`
pour le cas « aucune idée à cette étape ».

- [ ] **Étape 4 : simplifier l'aiguillage**

`src/sidepanel/App.tsx` :

```tsx
const [route, setRoute] = useState<Route>({ selectedId: null });
```

et, à la place du `switch` à trois branches, le rendu des deux volets. Tant que
la tâche 10 n'a pas posé la mise en page adaptative, garder le comportement
étroit : la liste si `selectedId` est `null`, le détail sinon.

- [ ] **Étape 5 : vérifier**

```bash
pnpm typecheck && pnpm lint && pnpm test
grep -rn "HomeScreen\|PREVIEW_LIMIT" src/
```

Attendu : tout vert, et le `grep` **sans résultat** — une référence oubliée à un
écran supprimé ne compilerait pas, mais un import mort dans un commentaire, si.

Puis `pnpm build`, recharger : le panneau ouvre sur la liste complète, le
composeur en haut, la recherche et les filtres visibles d'emblée. Ouvrir une
idée, revenir : on revient à la liste, qui est le seul endroit d'où l'on vienne.

- [ ] **Étape 6 : commit**

```
refactor(ui): merge the home screen into the list

The list column already held the composer, the counters and the recent
ideas, so the home screen had nothing of its own. Three screens become
two, and Route stops naming a destination — it names a selection.

This is what removes the back button that lied: coming from home or
from the list, "back" always went to the list. There is now one place
to come from.
```

---

## Tâche 10 : le maître-détail adaptatif

**Fichiers :**

- Créer : `src/sidepanel/App.module.css`
- Modifier : `src/sidepanel/App.tsx`
- Modifier : `src/screens/ListScreen.module.css`,
  `src/screens/DetailScreen.module.css`
- Modifier : `src/components/IdeaHeader/IdeaHeader.tsx`
- Modifier : `src/components/IdeaCard/IdeaCard.tsx` et son module CSS

- [ ] **Étape 1 : la coquille**

`App.module.css` — le seuil vaut 720 px : 306 pour la liste, ~380 minimum pour
que le texte d'une idée garde une longueur de ligne lisible, plus les
gouttières.

```css
/* Le Side Panel est un document a lui seul : sa fenetre EST le panneau, donc
 * @media repond bien a la largeur du panneau. C'est l'un des rares cas ou une
 * requete de conteneur n'apporterait rien. */
.shell {
  display: flex;
  gap: var(--space-2);
  height: 100vh;
  padding: var(--space-2);
  overflow: hidden;
}

.master,
.detail {
  min-width: 0;
  min-height: 0;
}

.master {
  flex: 1;
}

/* Sous le seuil : un seul volet a la fois, celui que la selection designe. */
.detail {
  display: none;
  flex: 1;
}

.selected .master {
  display: none;
}

.selected .detail {
  display: flex;
}

@media (min-width: 720px) {
  .master {
    flex: none;
    width: 306px;
  }

  .detail,
  .selected .master {
    display: flex;
  }
}
```

`min-width: 0` sur les deux volets n'est pas décoratif : sans lui, un enfant
flex refuse de rétrécir sous sa taille de contenu, et un texte long pousse la
colonne au-delà du panneau.

- [ ] **Étape 2 : deux zones de défilement**

Le patron existant est le bon et se duplique : chaque volet est en
`display: flex; flex-direction: column; overflow: hidden`, et **une seule** zone
intérieure porte `overflow-y: auto`.

Dans `ListScreen.module.css`, retirer `height: 100vh` de `.list` (la coquille
porte la hauteur désormais) et garder `overflow-y: auto` sur `.rows` seulement.
Titre, composeur, recherche et filtres restent hors de la zone défilante : le
composeur ne doit jamais sortir du champ.

Même opération sur `DetailScreen.module.css:10-18`.

- [ ] **Étape 3 : l'état vide du volet détail**

Nouveau au large : rien n'est sélectionné. Dans `DetailScreen`, quand
`selectedId` vaut `null` :

```tsx
<div className={styles.nothing}>
  <p className={styles.nothingTitle}>
    Choisis une idée à faire mûrir.
  </p>
</div>
```

- [ ] **Étape 4 : le retour conditionnel**

`IdeaHeader` reçoit `onBack?: () => void` au lieu de l'exiger. `App` ne le passe
que sous le seuil, où le volet détail occupe tout le panneau. Au large, la liste
est visible à côté : un retour n'aurait rien à faire.

La largeur se lit avec `matchMedia('(min-width: 720px)')` dans `App`, écoutée
par un `useEffect` — c'est une synchronisation avec l'extérieur, l'usage que
`.claude/rules/react.md` autorise.

- [ ] **Étape 5 : la carte sélectionnée**

`IdeaCard` reçoit `selected?: boolean`. Dans son module :

```css
/* Bordure et halo, pas un fond different : une troisieme surface annulerait
 * le travail de la tache 1. */
.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgb(3 140 140 / 0.13);
}
```

- [ ] **Étape 6 : vérifier**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Extension rechargée, **tirer le bord du panneau de bout en bout** :

1. **Au large (> 720 px)** : les deux volets. Cliquer une carte ouvre l'idée à
   droite, la liste reste. Pas de bouton retour. La carte cliquée porte son halo.
2. **À l'étroit (< 720 px)** : la liste seule ; cliquer une carte remplit le
   panneau, le retour réapparaît et ramène à la liste.
3. **Le passage du seuil, une idée ouverte** : élargir depuis l'étroit doit
   faire apparaître la liste à côté sans fermer l'idée.
4. **Les deux défilements** : au large, faire défiler une longue liste ne bouge
   pas le volet droit, et l'inverse. Le composeur ne bouge jamais.
5. **Un texte très long sans espace** (coller 200 caractères d'affilée) ne doit
   élargir aucune colonne — c'est ce que `min-width: 0` protège.

- [ ] **Étape 7 : commit**

```
feat(ui): lay the panel out as master-detail when it is wide

The panel is user-resizable up to half the screen and runs at ~960px,
but the front had no width rule at all: one @media for reduced motion,
one max-width on a paragraph. The layout stretched instead of
reorganising — 860px cards holding three words.

Above 720px the list and the open idea sit side by side; below it, one
at a time, as before.
```

---

# Lot D — Le cœur

## Tâche 11 : Corriger et Reformuler

Le geste qui coûte cher aujourd'hui : produire une v4 demande de retaper l'idée
entière dans un champ vide, 300 px sous le texte à faire évoluer.

**Fichiers :**

- Créer : `src/components/CurrentVersion/CurrentVersion.tsx` + module CSS
- Créer : `test/draft.test.ts`
- Modifier : `src/lib/variations.ts`
- Modifier : `src/screens/DetailScreen.tsx` et son module CSS
- Modifier : `src/components/VariationThread/VariationThread.tsx`
- Modifier : `src/components/Composer/Composer.tsx`

- [ ] **Étape 1 : écrire le test qui échoue**

`test/draft.test.ts` :

```ts
import { describe, expect, it } from 'vitest';

import { isMeaningfulDraft } from '@/lib/variations';

describe('a reformulation draft', () => {
  it('is meaningful when the text actually changed', () => {
    expect(isMeaningfulDraft('nouvelle version', 'ancienne')).toBe(
      true,
    );
  });

  it('is not meaningful when it matches the current text', () => {
    expect(isMeaningfulDraft('même texte', 'même texte')).toBe(false);
  });

  it('ignores surrounding whitespace on both sides', () => {
    expect(isMeaningfulDraft('  même texte \n', 'même texte')).toBe(
      false,
    );
  });

  it('is not meaningful when it is empty', () => {
    expect(isMeaningfulDraft('   ', 'ancienne')).toBe(false);
  });
});
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
pnpm test draft
```

Attendu : échec, `isMeaningfulDraft` n'est pas exporté.

- [ ] **Étape 3 : l'implémenter**

Ajouter à `src/lib/variations.ts` :

```ts
// Un brouillon identique au texte courant serait une version qui ne varie pas.
export function isMeaningfulDraft(
  draft: string,
  current: string,
): boolean {
  const trimmed = draft.trim();
  return trimmed.length > 0 && trimmed !== current.trim();
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
pnpm test draft
```

Attendu : 4 tests verts.

- [ ] **Étape 5 : le composant du texte courant**

`CurrentVersion.tsx` — lecture par défaut, édition sur demande. C'est le
deuxième cas réel d'une bascule lecture/édition : `VariationThread` la faisait
pour toutes les variations, il ne la fera plus que pour les anciennes.

```tsx
import { useState } from 'react';
import VariationEditor from '@/components/VariationEditor/VariationEditor';
import type { Variation } from '@/storage/types';
import styles from './CurrentVersion.module.css';

interface Props {
  variation: Variation;
  // Rejette quand la correction n'a pas pu etre enregistree, ce qui garde
  // l'editeur ouvert avec le texte dedans.
  onFix: (text: string) => Promise<unknown>;
}

export default function CurrentVersion({ variation, onFix }: Props) {
  const [fixing, setFixing] = useState(false);

  if (fixing) {
    return (
      <VariationEditor
        initialText={variation.text}
        onSave={async (text) => {
          await onFix(text);
          setFixing(false);
        }}
        onCancel={() => setFixing(false)}
      />
    );
  }

  return (
    <div className={styles.current}>
      <p className={styles.text}>{variation.text}</p>
      <button
        type="button"
        className={styles.fix}
        onClick={() => setFixing(true)}
      >
        ✎ Corriger
      </button>
    </div>
  );
}
```

- [ ] **Étape 6 : ses styles**

```css
.current {
  position: relative;
}

.text {
  margin: 0;
  max-width: 58ch;
  font-size: var(--text-hero);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* L'affordance est le defaut connu de l'edition en place : sans signe visible,
 * la fonction n'existe pas. Elle apparait au survol et reste atteignable au
 * clavier, ou le survol ne se produit jamais. */
.fix {
  position: absolute;
  top: 0;
  right: 0;
  opacity: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--ring);
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  padding: 3px 9px;
  cursor: pointer;
}

.current:hover .fix,
.fix:focus-visible {
  opacity: 1;
}

.fix:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

`58ch` n'est pas arbitraire : la longueur de ligne confortable tient entre 45 et
75 caractères, 66 visé, et le WCAG plafonne à 80.

- [ ] **Étape 7 : le brouillon pré-rempli**

`Composer` reçoit deux props optionnelles :

```tsx
interface Props {
  onSubmit: (text: string) => Promise<unknown>;
  autoFocus?: boolean;
  // Pre-remplit le champ. La reformulation part du texte courant : on le
  // retouche au lieu de le reecrire.
  initialText?: string;
  placeholder?: string;
}
```

`useState(initialText ?? '')` à l'initialisation. Le `PLACEHOLDER` constant
devient une valeur par défaut de prop — son commentaire « lot 4 introduira une
prop » décrit ce moment précis, et disparaît avec lui.

- [ ] **Étape 8 : l'assemblage du volet détail**

`DetailScreen` rend, dans cet ordre : `StatusPicker` · `CurrentVersion` · le
bouton **Reformuler** · les versions précédentes.

Le bouton ouvre un `Composer` avec `initialText={currentVariation(idea).text}`
et `placeholder="Reformuler…"`, accompagné de « Repartir d'une page blanche »
(qui vide le champ) et « Annuler ». L'enregistrement n'appelle `addVariation`
que si `isMeaningfulDraft(draft, currentVariation(idea).text)`.

`VariationThread` reçoit `previousVariations(idea)` au lieu de
`idea.variations`, et perd son marquage `.current` — la variation courante ne
passe plus par lui. Sa bascule d'édition reste, pour corriger une ancienne
version depuis son menu ⋮.

Le champ de reformulation remonte **directement sous le texte qu'il
transforme**, et l'historique occupe le bas : c'est ce qui supprime les 128 px
de vide actuels.

- [ ] **Étape 9 : vérifier**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Extension rechargée, sur une idée existante :

1. **Corriger.** Survoler le texte courant : « ✎ Corriger » apparaît. Cliquer,
   changer un mot, enregistrer. Le texte change et **le nombre de versions ne
   bouge pas**.
2. **Reformuler.** Cliquer le bouton : le champ s'ouvre **avec le texte courant
   dedans**, curseur au bout. Modifier, enregistrer. Une version de plus, le
   texte courant est le nouveau, l'ancien est passé dans l'historique.
3. **Le brouillon vide.** Reformuler sans rien changer, enregistrer : rien ne se
   passe, aucune version n'est créée.
4. **La page blanche.** Cliquer « Repartir d'une page blanche » : le champ se
   vide, on écrit autre chose, on enregistre. Une version de plus.
5. **Au clavier.** Atteindre « ✎ Corriger » à la tabulation sans jamais survoler
   — il doit devenir visible en recevant le focus.

Le point 5 est celui qu'on oublie : une affordance qui n'existe qu'au survol
n'existe pas pour qui n'a pas de souris.

- [ ] **Étape 10 : commit**

```
feat(detail): make reformulating cost less than retyping

Producing a new version meant retyping the whole idea into an empty
field 300px below the text it was meant to evolve — a messaging
pattern applied to a writing task. 29 ideas, zero reformulations.

Reformuler now opens a draft pre-filled with the current text, and
fixing a typo gets its own affordance on the text itself instead of
hiding in a per-variation overflow menu.
```

---

# Lot E — La documentation

## Tâche 12 : remettre les documents d'accord avec le code

**Fichiers :** `README.md`, `CLAUDE.md`, `.claude/rules/react.md`,
`.claude/rules/css.md`, `.claude/rules/structure.md`, `design/mockup.html`,
`src/styles/tokens.css`, `.gitignore`

- [ ] **Étape 1 : `.claude/rules/css.md`**

Documenter les deux surfaces, l'échelle typographique nommée, et la règle
nouvelle : **toute couleur portant du texte atteint 4,5:1**. Noter que `--faint`
ne se pose jamais en `color`.

- [ ] **Étape 2 : `.claude/rules/react.md`**

Section « Entorses assumées » — deux entrées à ajouter :

- **`IdeasProvider` fabrique une idée que le serveur n'a pas encore vue.**
  Statut initial et dates sont devinés côté panneau : une règle serveur
  dupliquée, le temps d'un aller-retour. Sans elle, la promesse de rapidité du
  produit ne tient pas sur une API distante.
- **`ListScreen` lit deux contextes** (`useIdeas` et `useSession`). L'entrée
  existante nomme `HomeScreen`, qui n'existe plus : la corriger plutôt que d'en
  ajouter une.

Ajouter `CurrentVersion` à l'exemple du « 2ᵉ cas réel », à côté d'`ActionMenu` :
il naît parce qu'une bascule lecture/édition existe à deux endroits distincts.

- [ ] **Étape 3 : `.claude/rules/structure.md`**

`HomeScreen` disparaît de l'arborescence ; `CardSkeleton` et `CurrentVersion`
s'ajoutent ; `src/lib/` gagne `variations.ts` et `optimistic.ts`.

- [ ] **Étape 4 : `README.md`**

L'interface s'adapte à la largeur du panneau. Mentionner le seuil de 720 px et
le fait que le panneau se redimensionne — c'est la première chose qu'un nouvel
arrivant ne devinera pas.

- [ ] **Étape 5 : `CLAUDE.md`**

Le paragraphe sur le stockage dit que le panneau « passe par son service
worker » : inchangé et toujours vrai. Rien d'autre à corriger — cette brique ne
touche ni l'architecture ni le hors-scope.

- [ ] **Étape 6 : la filiation morte**

`src/styles/tokens.css` s'ouvre sur « Colors are reported verbatim from
design/mockup.html (no rounding) ». Après la tâche 1, c'est faux. Et
`design/mockup.html` décrit une interface à trois écrans dans une colonne
étroite, donc `HomeScreen.module.css` et consorts pointent vers des ancres qui
ne décrivent plus rien.

`.claude/rules/code-style.md` est explicite : « Une référence morte est du
bruit : on la retire. » Corriger le commentaire de `tokens.css` et retirer les
renvois à `design/mockup.html` en tête des modules concernés.

**Ne pas supprimer `design/mockup.html`** — c'est une décision PO, pas une tâche
de documentation.

- [ ] **Étape 7 : `.gitignore`**

Ajouter `.superpowers/` : les maquettes de conception s'y accumulent et n'ont
rien à faire dans le dépôt.

- [ ] **Étape 8 : vérifier**

```bash
pnpm format && pnpm lint && pnpm test
grep -rn "mockup.html" src/
grep -rn "HomeScreen" . --exclude-dir=node_modules --exclude-dir=.git
```

Attendu : le premier `grep` ne renvoie que les fichiers volontairement
conservés ; le second, plus rien hors des messages de commit historiques.

- [ ] **Étape 9 : commit**

```
docs: record the adaptive interface

Two surfaces, a named type scale and an AA floor on text colour are
project rules now, not choices made once. HomeScreen is gone from the
tree, and tokens.css no longer claims to descend from a mockup that
describes a layout we do not build.
```

---

## Ce que ce plan ne fait pas

- **Le thème sombre.** Tenir la teinte froide partout le rend possible plus
  tard ; il n'est pas décidé.
- **La palette de commandes `⌘K`** et la navigation complète au clavier.
- **Restaurer une ancienne version** — le modèle le permettrait, ce n'est pas
  décidé.
- **Le mode focus** qui estompe tout sauf le texte pendant l'écriture.
- **Annoter ou commenter une idée.**
- **Les tests de composants.** `@testing-library/react` n'est pas installé, et
  aucune tâche ne l'installe. Les bascules de mise en page, le survol et la
  restitution du texte se vérifient à la main, et chaque tâche dit comment.

## Notes / Blocage

- **La tâche 1 est large et silencieuse.** Un jeton supprimé mais encore
  référencé ne casse rien : la règle CSS est ignorée, et le défaut ne se voit
  que sur l'écran concerné. D'où le `grep` de l'étape 8 — c'est lui le test, pas
  l'œil.
- **La tâche 7 ne se prouve qu'en coupant le réseau.** Un affichage optimiste se
  juge sur sa rétractation, pas sur son affichage. Le cas nominal ne démontre
  rien.
- **La tâche 10 change la hauteur.** `100vh` passe de l'écran à la coquille. Si
  un volet se met à défiler tout entier au lieu de sa seule liste, c'est qu'un
  `overflow: hidden` manque à un niveau intermédiaire.
- **Le pari de la tâche 11 reste un pari.** Si `Maturation` reste à 0 après
  livraison, la cause n'était pas le coût de la reformulation, et c'est une
  question de produit — pas de design.
- **L'ordre des lots est négociable, sauf pour le lot A.** Les jetons portent
  tout le reste ; les tâches 2 à 4 peuvent glisser, la tâche 1 non.
