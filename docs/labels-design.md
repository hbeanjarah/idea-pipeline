# Étapes configurables — conception

> Le statut figé à quatre valeurs devient une liste que l'utilisateur écrit.
> Une idée est à **une seule** étape, ou à **aucune** — elle naît libre.

## Pourquoi

`ideas.status` porte aujourd'hui quatre valeurs écrites en dur à six endroits :
la migration SQL, le spec OpenAPI, les deux fichiers de types, les libellés
français et les couleurs. Ce choix a été payant — ajouter une étape casse la
compilation au lieu de laisser un libellé vide arriver à l'écran.

Mais ces quatre valeurs sont **celles d'une seule personne**. Le produit n'est
pas destiné à un seul usage, et rien ne dit que « Capturé · Maturation · Prêt ·
Publié » décrit le pipeline de quelqu'un d'autre. C'est le vocabulaire qui doit
devenir celui de l'utilisateur, pas le mécanisme.

## Décisions actées

| Sujet               | Décision                                                                   |
| ------------------- | -------------------------------------------------------------------------- |
| Cardinalité         | **une seule** étape par idée — pas des tags multiples                      |
| Vocabulaire         | **écrit par l'utilisateur**, propre à son compte                           |
| Ordre               | **modifiable**, mais c'est un ordre d'affichage, pas une progression       |
| Obligatoire ?       | **non** — une idée naît libre et peut le rester                            |
| Amorçage            | un écran propose les 4 étapes historiques, renommables dès le premier jour |
| Création par défaut | les 4 étapes sont posées **côté serveur**, à la création du compte         |
| Suppression         | les idées deviennent libres · `ON DELETE CASCADE` · confirmation chiffrée  |
| Stockage            | **table de liaison** contrainte à une seule ligne par idée                 |
| Chiffrement         | `labels.name` scellé par `store/notes.ts`, AAD = `user_id`                 |
| Couleurs            | attribuées automatiquement dans une palette de 8, jamais demandées         |
| Filtre              | **une seule rangée** + un débordement « +N » · aucun plafond d'étapes      |
| Réordonner          | glissement au pointeur **et** flèches — les deux, jamais l'un sans l'autre |
| Nom                 | 32 caractères au plus · doublons refusés                                   |

## Ce que c'est, et ce que ce n'est pas

**C'est un statut, pas un tag.** La distinction n'est pas de vocabulaire.

Les outils matures convergent tous vers **deux axes** : un axe « où ça en est »
(unique, exclusif, souvent nommé par l'utilisateur) et un axe « de quoi ça
parle » (multiple, libre). Linear a ses _statuses_ et ses _labels_, Notion sa
propriété _Status_ et ses _Multi-select_, Trello ses listes et ses étiquettes.
Linear écrit d'ailleurs dans sa documentation l'erreur à éviter : ne pas
refaire ses statuts sous forme d'étiquettes.

**Nous ne construisons que le premier axe**, et ce n'est pas un report.
La recherche en gestion de connaissance personnelle est convergente : étiqueter
par **sujet** se dégrade avec le volume — dans un corpus de mille documents un
mot porte une dizaine d'usages, à cent mille il en porte quatre-vingt-quatre —
tandis qu'étiqueter par **étape du cycle de vie** tient, parce que les étapes
sont « peu nombreuses et bougent lentement ».

Le second axe est donc celui dont on sait qu'il échoue le plus souvent. Ne pas
le construire, c'est décliner, pas différer.

**Conséquence de conception** : la liste proposée à l'amorçage est l'opinion du
produit. En montrant « Capturé · Maturation · Prêt · Publié », elle enseigne de
quelle **nature** une étape doit être. C'est le garde-fou le moins cher contre
la prolifération.

## Le modèle : une table de liaison contrainte à un

```sql
CREATE TABLE labels (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text        NOT NULL,   -- scellé
  color      integer     NOT NULL,   -- 1..8, en clair
  position   integer     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX labels_user_id_idx ON labels (user_id, position);

CREATE TABLE idea_labels (
  idea_id  uuid NOT NULL REFERENCES ideas  (id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, label_id),
  CONSTRAINT idea_labels_one_per_idea UNIQUE (idea_id)
);
CREATE INDEX idea_labels_label_id_idx ON idea_labels (label_id);
```

Une colonne `label_id` sur `ideas` serait plus simple aujourd'hui. La table de
liaison est choisie pour une raison précise : **la clé primaire autorise déjà
plusieurs étiquettes par idée, et une seule ligne dit « une seule »**. Le jour
où le besoin du multiple apparaît :

```sql
ALTER TABLE idea_labels DROP CONSTRAINT idea_labels_one_per_idea;
```

Aucune donnée touchée, aucun déchiffrement. Les deux changements futurs n'ont
pas le même prix : une migration de **données** se fait sans filet — et ici sur
des lignes chiffrées — tandis qu'une migration de **contrat** est trouvée par le
compilateur à chaque endroit oublié. On rend donc les données définitives
maintenant et on garde le code au présent.

Deux cadeaux au passage : le `ON DELETE CASCADE` sur `label_id` **est** la règle
de suppression choisie — supprimer une étape efface les liens, les idées
survivent — et « une idée libre » s'écrit simplement « pas de ligne ».

**Pas d'unicité sur `position`.** Réordonner échange des positions et violerait
l'unicité le temps d'une transaction, ce qui imposerait une contrainte différée.
On trie sur `position, id` et on tolère les ex æquo.

## Le chiffrement

`labels.name` est du contenu utilisateur : il est scellé par `store/notes.ts`,
au même titre qu'une note. La règle de `structure.md` tient sans exception —
_chiffrement → `store/notes.ts`, et nulle part ailleurs_.

**L'AAD est le `user_id`**, et non l'`id` de l'étiquette : Postgres ne génère
celui-ci qu'à l'insertion, alors que le scellement le précède. La protection est
la même — une ligne recopiée dans un autre compte ne s'ouvre pas.

`color` et `position` restent en clair : une valeur parmi huit et un entier ne
disent rien de ce que l'utilisateur écrit. Une ligne `ideas` ne porte plus
qu'un `uuid` d'étape : qui lit la base voit que trois idées partagent une étape,
sans pouvoir savoir laquelle, ni combien il en existe.

**Ce chiffrement ne coûte aucune fonctionnalité**, parce que `GET /ideas`
renvoie déjà tout sans filtre ni tri — tranché dans `api-design.md` — et que
`filterIdeas.ts` filtre en mémoire. Il n'y a pas un seul `WHERE status = …` à
préserver. Le prix est pour plus tard : un `GROUP BY` côté serveur pour compter
les idées par étape restera impossible.

**Une conséquence immédiate** : l'unicité des noms ne peut pas être une
contrainte SQL. Chaque scellement utilise un IV aléatoire, donc deux étiquettes
nommées « Prêt » produisent deux chiffrés différents et un index unique ne
verrait rien. Le refus des doublons vit donc dans le service, qui déchiffre la
liste du compte et compare — après `trim`, casse ignorée, **accents non
repliés**, la règle déjà retenue pour la recherche (« é » ≠ « e »).

Limite assumée : sans contrainte en base, deux créations simultanées du même nom
passeraient toutes les deux. Sur un compte piloté par une seule personne depuis
un panneau, c'est négligeable — mais ce n'est pas zéro.

## Les couleurs

Attribuées **automatiquement**, jamais demandées : l'utilisateur nomme une
étape, il ne dessine pas. La règle : la première des huit qui n'est pas déjà
prise ; si les huit le sont, `(nombre d'étiquettes % 8) + 1`. La version naïve —
compter et prendre la suivante — se trompe dès la première suppression.

La couleur est **rangée en colonne**, jamais dérivée de la position : la dériver
ferait repeindre toute la liste à chaque réordonnancement.

L'API ne transporte qu'un **numéro d'emplacement**. Les huit valeurs vivent dans
`tokens.css`, seul endroit du dépôt où une couleur est écrite (`css.md`). Les
quatre premières sont exactement les quatre couleurs de statut d'aujourd'hui :
après la reprise, un compte existant est visuellement identique.

## L'API

| Verbe    | Chemin         | `operationId`   | Corps → Réponse                          |
| -------- | -------------- | --------------- | ---------------------------------------- |
| `GET`    | `/labels`      | `listLabels`    | → `200` `Label[]`, triées par `position` |
| `POST`   | `/labels`      | `createLabel`   | `{ name }` → `201` `Label`               |
| `PATCH`  | `/labels/{id}` | `renameLabel`   | `{ name }` → `200` `Label`               |
| `DELETE` | `/labels/{id}` | `deleteLabel`   | → `204`                                  |
| `PATCH`  | `/labels`      | `reorderLabels` | `{ ids: [...] }` → `200` `Label[]`       |

`PATCH /ideas/{id}` existe déjà et portait `{ status }` ; il porte désormais
`{ labelId }`, où `null` détache. `changeIdeaStatus` devient `setIdeaLabel`.
C'est le seul endpoint existant à changer de forme.

**Le réordonnancement est sur la collection**, pas sur l'élément : un
déplacement bouge une étiquette mais renumérote toutes les autres. Des
`PATCH /labels/{id} { position }` demanderaient N appels dont l'entrelacement
produirait des ordres incohérents. `PUT /labels/order` a été écarté : ce chemin
entre en collision avec `/labels/{id}`, où `order` serait lu comme un
identifiant.

Schémas :

```yaml
Label:
  required: [id, name, color, position]
  properties:
    id: { type: string, format: uuid }
    name: { type: string, minLength: 1, maxLength: 32 }
    color: { type: integer, minimum: 1, maximum: 8 }
    position: { type: integer }

Idea:
  # status: enum[4]  ← disparaît
  labelId: { type: string, format: uuid, nullable: true }
```

Erreurs, aux messages du contrat :

| Cas                                   | Code  | Message                                 |
| ------------------------------------- | ----- | --------------------------------------- |
| `name` absent, vide ou espaces        | `400` | « Le nom de l'étape est obligatoire. »  |
| `name` de plus de 32 caractères       | `400` | « Le nom de l'étape est trop long. »    |
| `name` déjà porté par une autre étape | `400` | « Cette étape existe déjà. »            |
| `labelId` ou `id` inconnu             | `404` | « Étape introuvable. »                  |
| `ids` incomplet                       | `400` | « La liste des étapes est incomplète. » |

Le `404` plutôt qu'un `403` pour l'étiquette d'autrui : même règle que les
idées, on ne divulgue pas son existence.

## L'interface

**Une idée naît libre**, donc l'invitation à classer est présente sur la
majorité des cartes. Aujourd'hui `captured` ne signifie pas « j'ai décidé que
cette idée est à l'étape de capture » mais « personne n'y a jamais touché » ; un
état libre rend le champ honnête — une étape présente signifie que quelqu'un l'a
choisie.

**L'emplacement de l'étiquette existe toujours**, rempli ou non. Une carte libre
montre l'étiquette _vide_ : même fond, même rayon, pastille creuse au lieu de
pleine. Classer revient visuellement à **colorer le point**, et rien ne se
décale. Un chevron marque les **deux** états — sans lui la carte libre
annoncerait un menu que la carte classée cacherait, alors qu'elles ouvrent le
même. Un « + » a été écarté : il promet une création alors qu'on choisit dans
une liste existante.

**`IdeaCard` cesse d'être un `<button>`.** C'est une contrainte, pas un choix :
`Popover` enveloppe son déclencheur dans un `<button>`, et un bouton imbriqué
est du HTML invalide — le navigateur répare en fermant le bouton extérieur trop
tôt, la mise en page casse et les clics partent ailleurs. La carte devient un
conteneur, le texte un bouton d'ouverture, l'étiquette un **frère**. Prix :
la rangée méta n'ouvre plus l'idée, et le parcours clavier compte deux arrêts
par carte au lieu d'un.

**Le filtre tient sur une seule rangée**, sans plafonner le nombre d'étapes. La
note de `StatusFilter.module.css` disait « rien ne doit sortir de l'écran » et
désignait le coupable : une barre de défilement horizontale cachée. Son
intention réelle était **« rien ne doit disparaître à l'insu de l'utilisateur »**
— une icône qui annonce le reste la respecte en abandonnant sa lettre.

Mécanique : `flex-wrap: wrap` conservé, hauteur bridée à une rangée, et les
pastilles rejetées repérées à leur `offsetTop` supérieur à celui de la première ;
un `ResizeObserver` relance la mesure quand le panneau change de largeur.
`Tous` et `Sans étape` sont épinglées, et la pastille active est toujours tirée
dans la rangée visible — sinon le filtre mentirait sur ce qu'il filtre.

**Zéro étape est un état légal**, pas un cas limite : une idée peut être libre
et une étape peut être supprimée, donc un compte peut n'en avoir aucune. Il n'y
a alors pas de rangée de filtre — `Tous` et `Sans étape` diraient la même chose.

**La navigation gagne une quatrième surface.** `Route` devient enfin l'union
discriminée que `structure.md` décrit depuis le début :

```ts
export type Route =
  | { screen: 'ideas'; selectedId: string | null }
  | { screen: 'labels' };
```

L'écran des étapes remplace la coque tant qu'il est ouvert. **Un seul
composant, deux en-têtes** : « Commencer » à l'amorçage, une croix ensuite.

**Un `LabelsProvider` séparé** d'`IdeasProvider` : les étapes ont leur propre
cycle et leur propre comportement optimiste, les fondre ferait un provider qui
fait deux métiers. Conséquence à consigner : `ListScreen` lira **trois**
contextes, et la note de `react.md` qui dit qu'il est le seul à en lire deux
doit être réécrite.

**L'entrée optimiste se simplifie.** `IdeasProvider` devinait le statut initial
— « une règle serveur dupliquée ». Une idée naît libre : `labelId: null`.

## Réordonner : glissement **et** flèches

Pouvoir changer l'ordre n'est pas un confort. **Sans lui, une erreur d'ordre est
incorrigible sans perdre du classement** : renommer déplace le mot mais pas les
idées, et supprimer détache tout. La première liste écrite serait définitive —
écrite à l'amorçage, au moment où l'utilisateur connaît le moins bien son
besoin.

Le geste combine les deux, et ce n'est pas un luxe : **WCAG 2.2, critère 2.5.7
(_Dragging Movements_, niveau AA)** exige que toute fonction opérable par
glissement le soit aussi avec un pointeur unique, sans glisser. Les flèches ne
sont donc pas la version économique du glissement — **elles en sont la
condition**. Le projet se tient au niveau AA depuis la brique contraste.

La poignée porte le glissement (souris et tactile, via les _pointer events_) ;
les deux flèches portent le reste. Le glyphe est **six points en 2×3** — ce
qu'utilisent Notion, Linear et Jira pour exactement ce geste : l'icône la plus
explicite n'est pas la plus descriptive, c'est celle qui est déjà apprise
ailleurs. Les points sont des **disques pleins** : tracés au trait, à 15 px de
côté, ils ne produisent que du gris. La zone de préhension déborde le glyphe
(`padding` compensé par une marge négative) pour offrir une cible de 21 px au
doigt.

## Ce qui meurt

- `src/lib/statusLabels.ts` en entier — `STATUS_LABELS`, `STATUS_ORDER`.
- Le type `Status`, côté front et côté serveur.
- Les tokens `--status-captured` / `-maturing` / `-ready` / `-published`, et les
  classes CSS de même nom.
- `server/src/store/status-constraint.test.ts` — il n'existe que pour tenir
  honnête le cast `row.status as Status` face au `CHECK` SQL ; les deux
  disparaissent.
- Le `CHECK (status IN (…))` et la colonne `ideas.status`.
- **`src/storage/storage.ts`** et le chemin de reprise des idées d'avant la
  bascule vers l'API. Son modèle repose sur `Status` ; la maintenir serait du
  travail sur du code que plus personne n'exécute, pour un format qui n'existe
  plus.

## Les données existantes : trois étapes, dans cet ordre

`ideas.status` porte le classement réel des idées déjà écrites. Le convertir
demande un script, et non du SQL : **le nom d'une étiquette est chiffré**, donc
la conversion doit passer par `store/notes.ts`. Le moule existe — c'est celui de
`db:seal`.

| #     | Quoi                                                                            | Forme       |
| ----- | ------------------------------------------------------------------------------- | ----------- |
| **1** | `003_labels.sql` crée les deux tables                                           | migration   |
| **2** | `db:labels` convertit : 4 étiquettes scellées par compte, puis un lien par idée | script Node |
| **3** | `004_drop_status.sql` supprime la colonne et sa contrainte                      | migration   |

**L'ordre est la sécurité.** Supprimer la colonne avant l'étape 2, c'est perdre
le classement sans retour — la leçon de la tâche 7 du plan sécurité.

Bonne nouvelle : **la seule migration de données de cette brique porte sur la
seule colonne qui n'est pas secrète.** On lit `status` en clair, on écrit des
liens en clair ; rien à déchiffrer, rien à rechiffrer.

Un compte neuf et un compte repris arrivent dans le **même état** : quatre
étapes, mêmes noms, mêmes couleurs. Un seul cas à tester.

## Tests

- `store/labels.test.ts` — les cinq opérations, l'attribution de couleur, la
  contrainte « une seule étape par idée ».
- `store/adopt-labels.test.ts` — la conversion, et son idempotence.
- `services/labels.test.ts` — Zod, les 32 caractères, le refus des doublons
  (casse ignorée, accents non repliés), les `404`.
- `store/sealed-at-rest.test.ts` — **étendu à `labels.name`**. Ce garde-fou lit
  les lignes en SQL brut et échoue si un chemin d'écriture oublie de chiffrer ;
  sans extension, la seule protection contre un `INSERT` en clair ne regarderait
  pas la nouvelle table.
- `lib/filterIdeas` — filtrer sur une étape, sur « sans étape », sur « tous ».

**Une limite à dire plutôt qu'à masquer** : le débordement du filtre dépend
d'une mise en page réelle, que jsdom ne produit pas. La partie pure est testable
— « étant donné ces `offsetTop`, lesquelles sont cachées » — mais **pas** la
justesse de la mesure elle-même. Celle-là se vérifie à la main.

## Ce que cette brique laisse pour plus tard

- **Le second axe** — des étiquettes multiples par sujet. Le schéma en est
  capable ; le produit n'y invite pas.
- **Les catégories fixes** à la Linear/Notion (backlog / en cours / terminé),
  qui permettraient au logiciel de répondre « est-ce terminé ? » sans connaître
  le nom choisi. Utile le jour où un tableau de bord existera, inutile avant.
- **Le comptage côté serveur** par étape, définitivement fermé par le
  chiffrement tant que les noms restent scellés.
- **Le glisser-déposer entre étapes** depuis la liste — on classe par le menu.

## Points encore ouverts

Aucun ne bloque l'implémentation ; ils portent sur des détails de surface.

1. **L'amorçage vient-il après la connexion, ou après la première capture ?** La
   décision actée est « après la connexion ». La recherche sur l'onboarding
   pousse vers la seconde option — ne rien demander avant une première action
   qui compte — au moment où l'utilisateur a enfin une idée à ranger.
2. **Sauter l'amorçage** : vider la liste puis « Commencer » donne zéro étape.
   Suffisant, ou faut-il une sortie explicite ?
3. **« Gérer les étapes… » en pied du sélecteur** — seconde porte d'entrée vers
   l'écran de gestion, en plus du menu de compte. À garder ou à retirer.
4. **Les quatre couleurs nouvelles** (bleu, vert, prune, bronze) sont une
   proposition.

## Definition of Done

- Un compte neuf reçoit ses quatre étapes ; l'écran d'amorçage les propose et
  les laisse renommer, retirer, réordonner, compléter.
- Une idée naît libre et se classe **depuis la carte** comme depuis le détail.
- Supprimer une étape libère ses idées après une confirmation qui **annonce leur
  nombre** ; aucune idée n'est supprimée.
- Réordonner fonctionne au glissement **et** aux flèches, à la souris, au doigt
  et au clavier.
- Le filtre tient sur une rangée quel que soit le nombre d'étapes, et rien ne
  disparaît sans que « +N » le dise.
- `SELECT name FROM labels` ne renvoie que des `v1.…`, et
  `sealed-at-rest.test.ts` le prouve.
- La reprise a converti les idées existantes ; un compte repris est
  indiscernable d'un compte neuf.
- `ideas.status`, `Status`, `statusLabels.ts` et `storage.ts` ont disparu du
  dépôt.
- `lint`, `typecheck`, `test`, `build` verts ; `docs/openapi.yaml`,
  `docs/api-design.md` — dont la table exhaustive des messages,
  `.claude/rules/storage.md`, `react.md`, `structure.md`, `css.md` et
  `CLAUDE.md` à jour — dont le hors-scope, d'où « changement de statut : dans la
  vue détail uniquement » est retiré.
