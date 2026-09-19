# Le cadre du produit — dossier de débat

> **Rien n'est décidé ici.** Ce document rassemble ce qu'il faut pour trancher :
> le produit reste-t-il un pipeline de contenu, ou s'ouvre-t-il à la prise de
> notes ? Une fois la décision prise, il devient un document de conception ou
> il disparaît.
>
> Monté le 2026-09-19, à la demande du PO, avant la discussion.

## La question, précisément

Ce n'est **pas** « l'outil peut-il contenir des notes » — il le peut déjà, rien
n'empêche d'y taper ce qu'on veut. C'est : **le produit doit-il le dire ?**

Le coût est en vocabulaire et en périmètre, presque pas en code.

## Les quatre retours de test

D'une seule personne, qui utilise l'outil pour de vrai. Verbatim :

1. « Lorsque je crée une idée ou une note, quelquefois j'ai tendance à mettre un
   titre ; la description, c'est le corps de mes idées. » → **traité**, voir
   `title-design.md`.
2. « Je ne sais pas comment aller à la ligne ; lorsque je fais entrée, ça
   sauvegarde directement la note. » → **traité**, voir
   `writing-keys-design.md`.
3. « J'aimerais utiliser ton outil pour sauvegarder mes notes mais pas
   uniquement pour la création de contenu. Parce que j'oublie très vite,
   j'aimerais un outil de prise d'idée et de note aussi simple. » → **c'est le
   sujet de ce dossier.**
4. « Je ne sais pas si c'est possible d'avoir un système de classement
   automatique pour que je puisse voir où j'en suis sur mes tâches, avoir un
   aperçu. » → **gelé**, le PO doit redemander des précisions. Quatre lectures
   possibles sont consignées dans `interface-design.md`, section
   « Notes / Blocage ».

**La relecture du PO sur le 3** : ce que cette personne décrivait n'était pas
LinkedIn, c'était **la variation qui avait l'air obligatoire**. D'où le
rééquilibrage « Modifier » primaire / « Reformuler » secondaire, livré le
2026-09-19. Le symptôme est réparé ; la phrase sur les notes, elle, reste.

## Ce que les documents affirment aujourd'hui

| Source                                 | Ce qui est écrit                                                                                                                                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`, 1ʳᵉ ligne                 | « Ce n'est pas une appli de notes : c'est un **pipeline de contenu**. »                                                                                                                                                                                                      |
| `CLAUDE.md`                            | « L'unité n'est pas une note figée mais une **idée vivante** qui évolue par variations successives. »                                                                                                                                                                        |
| `labels-design.md`                     | L'étiquetage **par sujet** est **décliné, pas différé** — il se dégrade avec le volume, là où l'étiquetage par étape tient.                                                                                                                                                  |
| `labels-design.md`                     | Les quatre étapes semées sont « **l'opinion du produit** » : elles enseignent de quelle nature une étape doit être, et c'est « le garde-fou le moins cher contre la prolifération ».                                                                                         |
| `interface-design.md`, Notes / Blocage | Écrit **avant** la mise en test : « Si après livraison les compteurs ne bougent toujours pas, c'est que l'usage réel — des notes de travail plutôt que des idées de publications — diverge de la thèse du produit. Ce serait alors une question de produit, pas de design. » |

## Ce que le code impose

| Endroit                                         | Ce qu'il dit du cadre                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `grep -rni "linkedin" src/ server/src/`         | **1 occurrence** — un commentaire dans `src/lib/bullets.ts`                  |
| `DEFAULT_LABELS` (`server/src/store/labels.ts`) | `Capturé · Maturation · Prêt · Publié`                                       |
| Texte substitut du composer                     | « Une idée… »                                                                |
| Le reste                                        | **générique** — une idée, ses variations, une étape nommée par l'utilisateur |

**Le seul endroit où le produit affirme le cadre du post à un nouvel arrivant
est le mot « Publié »**, posé à la création du compte.

## Ce que dit l'usage réel

Relevé le 2026-09-19 sur la base de développement, 2 comptes, 30 idées.

**Les variations — le geste qui définit le produit :**

| Variations par idée   | Nombre d'idées |
| --------------------- | -------------- |
| 1 (jamais reformulée) | **25**         |
| 2                     | 4              |
| 3                     | 1              |

**Quand :**

| Mois de capture | Idées créées | Dont reformulées                            |
| --------------- | ------------ | ------------------------------------------- |
| 2026-06         | 11           | 4 — **toutes le jour même de leur capture** |
| 2026-07         | 16           | **0**                                       |
| 2026-08         | 1            | **0**                                       |
| 2026-09         | 2            | 1 — le 2026-09-18, un essai manuel          |

**Les étapes :**

| Rang de l'étape             | Idées |
| --------------------------- | ----- |
| 1 (`Capturé`)               | 21    |
| 2 (`Maturation`)            | 2     |
| 3 (`Prêt`)                  | **0** |
| 4 (`Publié`)                | **0** |
| 5 (créée par l'utilisateur) | **5** |

### Le contrôle qui limite ces chiffres

**La refonte censée faire couler le pipeline date du 2026-09-18** — brouillon de
reformulation pré-rempli, bouton remonté sous le texte, affichage optimiste
(`interface-design.md`). Les 17 idées de juillet et août ont donc été capturées
sous l'**ancienne** interface, celle où reformuler coûtait aussi cher que
capturer.

**Ces chiffres ne testent pas le correctif. Ils décrivent ce qui l'a motivé.**
Après la refonte, il n'existe qu'un seul jour d'usage réel.

### Ce que ces chiffres disent quand même

- **En trois mois, aucune idée n'a atteint `Prêt` ni `Publié`.** Les deux étapes
  qui portent la thèse « post LinkedIn » sont les deux qui sont vides.
- **Une cinquième étape, écrite par l'utilisateur, en contient cinq.** Le
  vocabulaire propre sert ; le vocabulaire semé, à moitié.
- **83 % des idées n'ont jamais été reformulées**, et les seules qui l'ont été
  le jour même de leur capture ressemblent à des essais de la fonctionnalité.

## Ce qui a été construit depuis, et qui ça sert

| Livré le 2026-09-19                                  | Sert l'usage « post »           | Sert l'usage « note »                   |
| ---------------------------------------------------- | ------------------------------- | --------------------------------------- |
| Le **titre** d'une idée                              | un repère dans sa propre liste  | oui — un post LinkedIn n'a pas de titre |
| `⏎` va à la ligne, `Ctrl+⏎` enregistre               | oui                             | oui                                     |
| « **Modifier** » primaire, « Reformuler » secondaire | affaiblit le geste de signature | oui                                     |

Aucun de ces trois ne tranche seul. Le titre est **ambigu** : il se défend
autant comme poignée d'organisation que comme affordance de note.

## Les arguments

### Pour ouvrir le cadre

- L'usage réel diverge de la thèse depuis trois mois, et `interface-design.md`
  avait nommé cette branche à l'avance.
- Le mécanisme est **déjà** générique ; le cadre fermé ne protège rien, il
  décourage.
- Deux des trois livraisons du jour servent mieux la note que le post.
- Coût en code quasi nul.

### Pour le garder fermé

- **Ce qui a été construit n'existe pas ailleurs.** Des applications de notes,
  il y en a mille ; une idée qui évolue par variations, non.
- Le besoin décrit par le retour 3 a **déjà reçu sa réponse** — le coût perçu de
  la modification, tombé le 2026-09-19.
- **Un point de donnée est un point de donnée** : une phrase, d'une personne.
- « Outil de notes » est une **porte** : dossiers, étiquettes par sujet, cases à
  cocher, rappels. `labels-design.md` a décliné la deuxième avec des arguments.
- Les chiffres ci-dessus **ne testent pas le correctif** : il a un jour.

## Ce qui trancherait

1. **Attendre trois à quatre semaines** et relire les mêmes requêtes. Si le taux
   de reformulation ne bouge pas alors que reformuler est devenu bon marché, la
   thèse du produit est fausse et le cadre doit suivre.
2. **Un deuxième testeur** qui dit la même chose que le premier.
3. **Demander à l'intéressé** ce qu'il met dedans aujourd'hui : des idées de
   publication, ou autre chose ?

## Les options

|       | Ce que ça veut dire                                                                          |
| ----- | -------------------------------------------------------------------------------------------- |
| **A** | Ouvrir : « capture et maturation d'idées », le post devient une sortie parmi d'autres        |
| **B** | Ne rien changer : le produit reste un pipeline de contenu                                    |
| **C** | Ne pas décider maintenant, observer                                                          |
| **D** | Garder le cadre **et** retirer ce qui l'impose — remplacer « Publié » dans les étapes semées |

**État : tranché le 2026-09-19 — option D.** Les étapes semées deviennent
« Capturé · Maturation · Prêt · **Terminé** ».

## La décision, et ce qu'elle ne tranche pas

« Publié » était le seul endroit du produit où le cadre éditorial était affirmé
à quelqu'un qui arrive. Il est **remplacé et non supprimé** : un cycle qui
s'arrête à « Prêt » ne se termine jamais, tout finirait par s'empiler à la
dernière étape, et l'aperçu que réclame le retour 4 se dégraderait avec le
volume. « Terminé » est vrai des trois usages envisagés — un post publié, un
compte-rendu transmis, un ticket écrit.

Restent ouverts :

- le cadre énoncé par `CLAUDE.md` et `README.md`, qui parlent toujours de posts
  LinkedIn et affirment « ce n'est pas une appli de notes » ;
- la question de fond du débat : si personne ne retravaille ses captures, ce
  n'est pas le vocabulaire qui est en cause.

Les comptes existants gardent « Publié » — les étapes sont semées à la création
du compte. Rien à migrer, et rien qui rattrape les deux comptes en place : ils
renomment à la main.
