# Interface — conception

> Maître-détail adaptatif · cartes · reformulation pré-remplie · affichage optimiste

## Pourquoi

Trois faits, tous constatés sur l'installation réelle.

**Le panneau n'a pas la largeur qu'on croyait.** Le CSS a été écrit d'après
`design/mockup.html`, large d'environ 360 px. Chrome laisse l'utilisateur tirer
le bord : le panneau en service fait **~960 px**. Or il n'existe **aucune**
règle de largeur dans tout le front —

```
grep -rn "@media"    src/  →  1 occurrence, prefers-reduced-motion
grep -rn "max-width" src/  →  1 occurrence, 32ch sur l'écran de connexion
```

— donc la mise en page s'étire sans se réorganiser : des cartes de 860 px qui
contiennent trois mots, un point de statut orphelin sous le texte, et 550 px de
vide sous « Toutes mes idées ».

**La rapidité a régressé à la mise en ligne.** `IdeasProvider.create` attend la
réponse du serveur **avant** d'afficher quoi que ce soit. Tant que
`chrome.storage.local` répondait en 2 ms, invisible ; depuis que l'API est à
Strasbourg, chaque ⏎ laisse l'écran immobile le temps d'un aller-retour. La
promesse du produit — la vitesse de capture — a été perdue sans que rien ne
l'annonce.

**Le pipeline ne coule pas.** `Capturé 24 · Maturation 0 · Prêt 0` : sur
29 idées, **aucune** n'a jamais été reformulée ni déplacée. L'outil s'appelle
pipeline et n'a jamais servi qu'à capturer. La cause la plus plausible est dans
l'interface : pour produire une v4, il faut retaper l'idée entière dans un champ
vide situé 300 px sous le texte qu'on veut faire évoluer. **Reformuler coûte
aujourd'hui aussi cher que capturer une idée neuve.**

## Décisions actées

| Sujet             | Décision                                                                       |
| ----------------- | ------------------------------------------------------------------------------ |
| Mise en page      | **Maître-détail** au-delà de 720 px, **colonne unique** en deçà                |
| Écrans            | `home` et `list` **fusionnent** — il en reste deux, plus un état vide          |
| Liste             | **Cartes**, variante « confort » : le statut garde sa ligne et son nom         |
| Statut            | Pastille + libellé sur la carte. **Pas** de rail coloré                        |
| Suppression       | Confirmation en deux temps, bouton **rouge plein** — seul aplat rouge de l'app |
| Corriger          | Affordance **sur le texte**, au survol — répare sans créer de version          |
| Reformuler        | Bouton permanent, brouillon **pré-rempli** de la version courante              |
| Écriture          | **Affichage optimiste**, retrait et restitution du texte en cas d'échec        |
| Couleurs de texte | Toute couleur portant du texte atteint **4,5:1** (WCAG AA)                     |
| Longueur de ligne | Le corps de texte est borné à **58ch** (~66 caractères visés)                  |
| Surfaces          | **Deux** au lieu de trois — un creux, une surface. Teinte froide tenue partout |
| Typographie       | Cinq **jetons** de taille, échelle contrastée `20 / 16 / 13 / 12 / 11`         |
| Chargement        | **Squelettes** à l'ouverture du panneau — jamais d'écran vide                  |
| Filtres           | **Retour à la ligne** au lieu du défilement horizontal à barre masquée         |
| Connexion         | Bloc **centré et borné** à 380 px, quelle que soit la largeur                  |
| Focus clavier     | `--focus-ring` sur **tout** élément focalisable                                |

Rien de tout cela ne touche l'API. **Aucun endpoint, aucun schéma, aucune
migration.** `editVariation` et `addVariation` existent déjà et portent
exactement les deux intentions dont l'interface a besoin.

## Les deux mises en page

Le panneau latéral est un document à lui seul : **sa fenêtre _est_ le panneau**.
Les `@media` y répondent donc à la largeur du panneau, sans recourir aux
requêtes de conteneur.

Le seuil est **720 px** : 306 px pour la liste, ~380 px minimum pour que le texte
d'une idée garde une longueur de ligne lisible, plus les gouttières.

```
≥ 720 px                              < 720 px
┌────────────┬──────────────────┐     ┌──────────────┐
│ composeur  │  statut  ⋮       │     │ composeur    │
│ recherche  │                  │     │ recherche    │
│ filtres    │  texte courant   │     │ filtres      │
│            │  ✎ corriger      │     │              │
│ ▸ carte    │  [Reformuler]    │     │ ▸ carte      │
│   carte    │                  │     │   carte      │
│   carte    │  ▾ versions      │     │   carte      │
└────────────┴──────────────────┘     └──────────────┘
                                      l'idée choisie prend
                                      tout le panneau
```

### Ce que la fusion supprime

La liste de gauche contient déjà tout ce que l'accueil offrait : le composeur,
les compteurs par étape, les idées récentes. L'accueil n'a plus de raison
d'être.

Disparaissent donc : `HomeScreen`, `PREVIEW_LIMIT` et son aperçu borné à cinq
cartes, le bouton « Toutes mes idées », le mini-pipeline (ses compteurs
rejoignent les puces de filtre, qui les portaient déjà), et le bouton retour de
`ListScreen`.

**Le routage se simplifie d'autant.** Aujourd'hui `Route` désigne une
destination parmi trois ; demain il ne désigne plus qu'une **sélection** :

```ts
export type Route = { selectedId: string | null };
```

Au large, `selectedId` décide de ce qu'affiche le volet droit ; `null` y met un
état vide. À l'étroit, `null` montre la liste et toute autre valeur montre
l'idée, avec un retour qui ne fait que remettre `null`.

Ce retour-là ne peut plus mentir. Le grief d'origine — « depuis le détail,
retour va toujours à la liste, même quand on vient de l'accueil » — disparaît
parce qu'il n'y a plus qu'un seul endroit d'où l'on vient.

## La liste — cartes confort

Une carte porte le texte de la variation **courante** (aujourd'hui elle affiche
la première, ce qui est un défaut : `IdeaCard` lit `idea.variations[0]` alors
que la dernière est celle qui fait foi), puis sur sa propre ligne la pastille de
statut, son libellé, et le nombre de versions s'il dépasse un.

La carte sélectionnée se distingue par sa bordure et un halo turquoise — pas par
un fond différent, qui ajouterait une quatrième surface.

**Densité assumée.** La variante confort montre ~7 idées à 500 px de haut,
contre ~11 pour une carte compacte. Le choix est celui du PO : le libellé écrit
en toutes lettres vaut le défilement supplémentaire.

## Le volet détail

De haut en bas : la pastille de statut (elle reste le déclencheur du
`StatusPicker`), le rang de version et la date, le menu ⋮ ; puis le **texte
courant**, borné à `58ch` ; puis le bouton **Reformuler** ; puis les versions
précédentes.

L'ordre compte. Aujourd'hui le champ de reformulation est en bas, séparé du
texte par l'historique et par 128 px de vide. Il remonte **directement sous ce
qu'il transforme**, et l'historique devient ce qui occupe le bas — une
respiration au lieu d'un trou.

### Corriger et Reformuler sont deux gestes, pas un

Le modèle les distingue déjà ; l'interface doit le rendre visible.

| Geste          | Ce que ça fait                           | Appel           | Affordance                           |
| -------------- | ---------------------------------------- | --------------- | ------------------------------------ |
| **✎ Corriger** | répare la version courante **sur place** | `editVariation` | apparaît **sur le texte**, au survol |
| **Reformuler** | ajoute une **nouvelle** version          | `addVariation`  | bouton permanent sous le texte       |

La découvrabilité est le défaut connu de l'édition en place — la littérature le
nomme explicitement : une affordance doit être présentée, sinon la fonction
n'existe pas. Aujourd'hui « Modifier » est enterré dans un menu ⋮ par variation,
et c'est probablement pour cette raison qu'aucune correction n'a jamais eu lieu.

Les versions précédentes gardent leur propre menu ⋮ pour être corrigées, mais
elles ne sont plus le chemin principal : le chemin principal est le texte en
haut.

### Le brouillon pré-rempli

« Reformuler » ouvre un éditeur **contenant déjà le texte de la version
courante**, curseur en fin. On retouche au lieu de réécrire.

- `⌘⏎` enregistre, `Échap` abandonne.
- « Repartir d'une page blanche » vide le brouillon d'un clic — le cas existe,
  il n'est simplement plus le défaut.
- Un brouillon identique au texte courant n'enregistre rien : ce serait une
  version qui ne varie pas.

Cela change ce qu'une variation **signifie** : elle naissait vierge, elle naîtra
dérivée. Le modèle de données ne bouge pas — `variations` reste en ajout seul,
la dernière fait foi — c'est l'invitation qui change.

## L'affichage optimiste

`IdeasProvider` affiche l'idée **avant** confirmation, à 50 % d'opacité, et le
champ se vide immédiatement. Au retour du serveur, l'idée provisoire est
remplacée par la vraie. En cas d'échec, elle est retirée et **le texte revient
dans le champ** avec l'alerte « Réessayer ».

La garantie d'origine est préservée : une idée tapée n'est jamais perdue par une
panne de réseau. C'est seulement l'endroit où elle est protégée qui change.

**L'état provisoire ne pollue pas le modèle.** `Idea` reflète `docs/openapi.yaml`
et `server/src/domain/types.ts` ; il ne gagne pas de champ `pending`. Le
fournisseur tient une liste séparée :

```ts
const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
  new Set(),
);
```

L'identifiant provisoire est engendré côté panneau et **ne quitte jamais le
panneau** : il est remplacé par celui du serveur dès la réponse.

Même traitement pour `changeStatus` — la pastille change de couleur tout de
suite et revient si le serveur refuse — et pour `deleteIdea`, où la carte
disparaît immédiatement.

## Les couleurs de texte

Mesures faites sur les jetons actuels, sur fond blanc (`--card`) :

| Jeton     | Valeur    | Contraste  | AA (4,5:1) |
| --------- | --------- | ---------- | ---------- |
| `--ink`   | `#323859` | **11,4:1** | ✔          |
| `--muted` | `#6f7891` | **4,40:1** | ✘ de peu   |
| `--hint`  | `#9aa3b5` | **2,54:1** | ✘          |
| `--faint` | `#aab2c4` | **2,13:1** | ✘          |

Trois des quatre couleurs de texte échouent. `--faint` porte les versions
précédentes : **l'historique d'une idée est aujourd'hui sous le seuil de
lisibilité**. `--hint` porte l'indication « ⏎ enregistrer » et tous les
sur-titres.

Une couleur qui passe AA sur `--panel` doit descendre à une luminance
d'environ 0,165 — c'est-à-dire presque aussi sombre que `--muted`. **La
hiérarchie à trois gris ne survit pas à AA** : elle se réduit à deux.

- `--muted` devient **`#5d667e`** — 5,63:1 sur `--surface`, 4,65:1 sur
  `--sunken`, conforme sur les deux.
- `--hint` et `--faint` cessent de porter du texte. Ils restent pour ce qui n'en
  est pas : bordures, pastilles inactives, icônes décoratives.

> **Correction après coup.** La table ci-dessus mesure sur fond blanc, base
> valable tant que `--card` existait. La section suivante le remplace par
> `--surface` et `--sunken` sans que ces mesures soient refaites : le `#66708a`
> d'abord retenu ne tenait que 4,01:1 sur `--sunken`, où se posent les pastilles
> de filtre, l'aide clavier et l'accroche de connexion. Le plancher se mesure
> désormais sur `--sunken`, fond le plus sombre que du texte rencontre.

## Les surfaces — deux au lieu de trois

Mesures des trois surfaces actuelles :

| Jeton     | Valeur    | Écart RGB | Verdict                     |
| --------- | --------- | --------- | --------------------------- |
| `--bg`    | `#e8ebf1` | 3,5 %     | gris **froid**, ~218°       |
| `--panel` | `#f2f6fc` | 3,9 %     | gris **froid**, ~216°       |
| `--card`  | `#ffffff` | **0 %**   | **neutre pur** — hors série |

**La teinte est juste et ne change pas.** Une teinte de 3 à 8 %, froide, est ce
que recommandent les systèmes de couleurs pour un outil de productivité. Deux
défauts seulement, et ils sont structurels :

**La température n'est pas tenue.** La série va froid → froid → neutre. La
carte — l'élément le plus répété de l'interface — est le seul à ne pas
appartenir au système.

**Les paliers sont sous le seuil de perception.** Carte contre panneau :
**1,085:1**. Panneau contre fond : **1,101:1**. Ce ne sont donc pas les fonds qui
structurent l'écran, ce sont les bordures ; retirer `--cardbd` et `--panelbd`
donnerait une nappe unique. Tolérable à 340 px, visible à 960.

La sortie retenue : **deux surfaces**.

```css
--sunken: #e2e8f2; /* le fond et la colonne maître, fusionnés */
--surface: #fcfdff; /* tout ce qui porte du contenu : cartes, volet détail */
```

Palier : **1,210:1**, plus du double d'aujourd'hui. `--bg`, `--panel` et `--card`
disparaissent au profit de ces deux-là.

Le blanc pur s'en va avec eux, et c'est voulu : le volet détail est une surface
de lecture de ~570 px portant du texte à 20 px, exactement le cas où le blanc pur
éblouit.

**Effet différé assumé.** Tenir la teinte froide partout rendrait un thème sombre
possible plus tard sans repartir de zéro — les neutres froids donnent la
profondeur qu'un neutre chaud, qui vire au brun, ne donne pas. Le thème sombre
**n'est pas décidé et n'est pas dans cette brique**.

## La typographie

L'inventaire des tailles existantes : **5 valeurs** (11, 12, 13, 14, 15 px)
réparties en **38 littéraux dans 16 fichiers**. La discipline est là, les jetons
manquent — et l'échelle progresse par pas de 1 px, donc rien ne ressort.

Cinq jetons, échelle contrastée, et un haut d'échelle qui n'existait pas :

```css
--text-hero: 20px; /* le texte courant, volet détail — nouveau */
--text-title: 16px; /* titres d'écran (absorbe 14 et 15) */
--text-body: 13px; /* le texte des idées — la bête de somme */
--text-sm: 12px; /* texte secondaire */
--text-xs: 11px; /* compteurs, dates, sur-titres */
```

**Aucune police n'est téléchargée.** La pile système reste : une extension qui
va chercher une fonte ajoute une requête réseau ou quelques centaines de
kilo-octets au paquet, pour un gain nul dans un panneau.

## Le défilement

Le patron est déjà correct et ne change pas : l'écran fait
`height: 100vh; overflow: hidden`, et une **seule** zone intérieure porte
`overflow-y: auto`. Le corps ne défile jamais. En maître-détail il s'applique
deux fois — une colonne, un défilement indépendant.

Dans la colonne maître, **composeur, recherche et filtres restent fixes** ;
seules les cartes défilent. Le composeur ne doit jamais sortir du champ : c'est
la promesse de capture immédiate.

**Un défaut à corriger.** `StatusFilter` défile horizontalement avec sa barre
masquée (`::-webkit-scrollbar { height: 0 }`). Dans une colonne de 306 px, les
cinq puces ne tiennent pas : « Prêt » et « Publié » sortent du champ et **rien
ne l'indique**. Invisible aujourd'hui — les filtres ne vivent que dans la liste ;
permanent demain. `flex-wrap: wrap` remplace `overflow-x: auto` : cinq étapes
visibles sur deux lignes, une propriété changée.

C'est aussi ce qui referme le grief d'origine « le pipeline n'est jamais un
pipeline » : ses quatre étapes et leurs compteurs sont en permanence à l'écran.

## Le chargement

Les trois écrans écrivent `{!loading && …}` : tant que la liste n'est pas
revenue, **rien n'est rendu**. Imperceptible quand `chrome.storage.local`
répondait ; depuis Strasbourg, ouvrir le panneau montre une surface vide.

Des **squelettes** remplacent le vide : trois formes de cartes à la place et à
la taille de celles qui arrivent, pulsation lente. L'œil se positionne avant que
les données existent, ce qu'un rotatif centré ne fait pas.

C'est le **seul** endroit où une attente reste visible. L'affichage optimiste
couvre toutes les écritures.

À noter : `loading` ne décrit que le **premier** chargement —
`setLoading(false)` n'est appelé que dans le `.finally()` de l'effet de montage.
C'est correct et le reste.

## L'écran de connexion

`.sign-in` n'a aucune largeur maximale et `.button` porte `width: 100%` : à
960 px, le bouton « Se connecter avec Google » mesure **960 px pour 190 px de
texte**. C'est le premier écran qu'on voit, et le plus déformé de l'application.

Le bloc est **borné à 380 px et centré**, quelle que soit la largeur. Une règle,
aucun écran nouveau, aucune illustration à maintenir.

## Le focus clavier

```
grep -rn "focus-visible" src/  →  2 résultats
```

Deux, sur une douzaine d'éléments focalisables. `IdeaCard` est un `<button>` sans
**aucun** style de focus. `SearchInput .input` porte `outline: none` **sans rien
mettre à la place** : le champ de recherche ne montre jamais qu'il est actif.

Le jeton `--focus-ring` existe déjà dans `tokens.css`. Il s'applique à tout ce
qui peut recevoir le focus : cartes, puces de filtre, déclencheurs de `Popover`
et d'`ActionMenu`, options de `StatusPicker`, boutons de `IdeaHeader`, et le
champ de recherche à qui `outline: none` a pris son état visible.

Ce n'est pas du confort : un outil qui se dit professionnel se parcourt à la
tabulation, et aujourd'hui on y est aveugle.

## Les composants

| Fichier           | Ce qui lui arrive                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `HomeScreen`      | **supprimé** — absorbé par la liste                                                          |
| `ListScreen`      | devient la colonne maître : composeur, recherche, filtres, cartes                            |
| `DetailScreen`    | devient le volet détail ; perd son retour au large, le garde à l'étroit                      |
| `IdeaCard`        | lit la **dernière** variation, gagne le libellé de statut et l'état sélectionné              |
| `Composer`        | gagne `initialText` et `placeholder` ; vide le champ **avant** confirmation                  |
| `VariationThread` | ne rend plus que les versions **précédentes** ; la courante monte d'un cran                  |
| `IdeaHeader`      | son retour devient conditionnel à la largeur                                                 |
| `StatusFilter`    | passe au retour à la ligne ; toujours visible au lieu d'être réservé à la liste              |
| `SearchInput`     | retrouve un état de focus visible, que `outline: none` lui avait pris                        |
| `SignInScreen`    | son bloc se borne à 380 px et se centre                                                      |
| `Popover`         | **rien** — Échap, clic extérieur, nettoyage des écouteurs : il est correct                   |
| `IdeasProvider`   | gagne l'optimisme et `pendingIds`                                                            |
| `App`             | n'aiguille plus entre trois écrans ; monte les deux volets, et n'en cache un que sous 720 px |

Un composant naît : **`CurrentVersion`** — le texte courant et son affordance
« ✎ Corriger ». Il bascule entre lecture et édition, ce que `VariationThread`
faisait pour toutes les variations et ne fera plus que pour les anciennes.
C'est un deuxième cas réel, pas une abstraction spéculative : les deux
appelants existent le jour où le composant est écrit.

## Tests

Ce qui est **pur** se teste sans rien installer :

- `filterIdeas` — déjà couvert, inchangé.
- Le choix de la variation affichée par une carte (la dernière, jamais la
  première) — extrait en fonction pure et testé.
- La réconciliation optimiste : remplacer une idée provisoire par celle du
  serveur, la retirer en cas d'échec. Extraite du composant en fonction pure sur
  `(ideas, pendingIds)`, testée directement.
- Un brouillon identique au texte courant n'engendre pas de version.

Ce qui ne l'est pas — le survol qui révèle « Corriger », la bascule de mise en
page à 720 px, la restitution du texte dans le champ — **ne se teste pas dans ce
dépôt aujourd'hui** : `@testing-library/react` n'est pas installé. Ce serait la
commande, si le PO l'autorise (elle n'est pas lancée) :

```bash
pnpm add -D @testing-library/react @testing-library/dom jsdom
```

Ces comportements sont donc vérifiés à la main, et la spec le dit plutôt que de
le taire.

## Dépendances

**Aucune.** CSS pur, `@media`, les composants existants. Le seul ajout possible
est celui des tests ci-dessus, et il est optionnel.

## Hors périmètre

- **Restaurer une ancienne version.** Le modèle le permettrait sans rien casser
  (ce serait une v4 dont le texte est celui de la v1), et Drafts comme Figma le
  proposent. Ce n'est pas décidé.
- **Palette de commandes `⌘K`** et navigation complète au clavier. Seuls
  `⌘⏎` et `Échap` entrent, parce qu'ils appartiennent au brouillon.
- **Mode focus** qui estompe tout sauf le texte pendant l'écriture.
- **Annoter ou commenter une idée** — le « discuter autour de l'idée » évoqué
  par le PO n'existe pas dans le modèle et n'est pas ouvert ici.
- **Réordonner à la souris**, vues groupées, tableau kanban.
- Tout ce que `CLAUDE.md` exclut du MVP reste exclu : pas d'IA, pas d'export,
  pas de partage, pas de hors-ligne.

## Notes / Blocage

- **Le seuil AA n'était écrit nulle part dans le projet.** Cette spec l'y
  inscrit : toute couleur portant du texte atteint 4,5:1. Le PO peut renverser
  ce choix — il touche presque tous les fichiers CSS — mais il faudrait alors
  assumer que l'historique d'une idée reste à 2,13:1.
- **Les jetons de surface changent de nom.** `--bg`, `--panel` et `--card`
  disparaissent au profit de `--sunken` et `--surface`. Ce sont 13
  occurrences dans 12 fichiers, plus 16 couleurs de texte ailleurs : mécanique,
  mais un jeton supprimé et encore référencé ne casse rien — la règle est
  ignorée en silence. La vérification ne peut donc pas être l'œil seul.
- **L'optimisme duplique une règle du serveur.** Pour afficher une carte avant
  la réponse, le panneau doit inventer son statut (`captured`) et ses dates.
  C'est une entorse assumée à « l'API est la seule source de vérité » : elle
  dure le temps d'un aller-retour, et la vraie idée écrase la provisoire. À
  consigner dans `.claude/rules/react.md`, section « Entorses assumées ».
- **`design/mockup.html` devient faux.** Il décrit une interface à trois écrans
  dans une colonne étroite. Les jetons de `src/styles/tokens.css` en sont
  « reportés verbatim » d'après leur propre commentaire — cette filiation ne
  tiendra plus. Soit la maquette est refaite, soit le commentaire est corrigé.
- **`Capturé 24 · Maturation 0 · Prêt 0` reste une hypothèse.** Cette spec parie
  que le coût de la reformulation explique l'immobilité du pipeline. Si après
  livraison les compteurs ne bougent toujours pas, c'est que l'usage réel — des
  notes de travail plutôt que des idées de publications — diverge de la thèse du
  produit. Ce serait alors une question de produit, pas de design.
- Cette spec suit la convention du dépôt (`docs/<sujet>-design.md`) plutôt que
  l'emplacement par défaut de la méthode de conception.
