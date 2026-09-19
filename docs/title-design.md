# Titre d'une idée — conception

> Une idée porte un titre, distinct de son texte. Il n'est jamais demandé à la
> capture, et il ne bouge pas quand on reformule.

> **Document en cours.** Les décisions ci-dessous sont actées. L'API, les
> fichiers touchés et le plan s'écrivent une fois les quatre retours de test
> passés — voir « Ce qui reste à trancher ».

## Pourquoi

Premier retour de test, d'une personne qui utilise l'outil pour de vrai :

> « Lorsque je crée une idée ou une note, quelquefois j'ai tendance à mettre un
> titre ; la description, c'est le corps de mes idées. »

Aujourd'hui une idée n'est qu'une suite de variations, et une variation n'est
qu'un `text`. Le titre que cette personne tape existe donc déjà — il est
simplement noyé dans le même bloc que le reste, et la carte l'affiche comme
n'importe quelle autre ligne.

Deux façons de répondre ont été examinées. La **convention de première ligne**
— pas de champ, la première ligne du texte s'affiche comme un titre — coûte
zéro migration, mais fait vivre le titre dans la variation : reformuler le
réécrit. Or le titre décrit **l'idée**, pas la version. Cette réponse a donc été
écartée au profit d'un **champ porté par l'idée**, malgré son coût : c'est la
première retouche du contrat depuis la mise en ligne.

## Décisions actées

| Sujet            | Décision                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| Porteur          | **l'idée**, jamais la variation — reformuler ne touche pas au titre        |
| Obligatoire ?    | **non** — nullable, une idée peut n'en avoir jamais                        |
| À la capture     | **jamais demandé** — le composer ne change pas, un champ, ⏎, c'est dedans  |
| Où on le pose    | dans le **détail**, en tête du corps, au-dessus de l'étape                 |
| Affordance       | ligne **toujours présente**, « Ajouter un titre » en `--muted` quand vide  |
| Édition          | **en place** au clic, comme « Corriger » et la pastille d'étape            |
| Validation       | `⏎` enregistre · `Échap` annule · **perdre le focus enregistre**           |
| Aide             | affichée **sous le champ pendant l'édition**, jamais au repos              |
| Retirer le titre | **vider le champ** — pas d'action « supprimer le titre » séparée           |
| Longueur         | **80 caractères** au plus                                                  |
| Taille à l'écran | `--text-hero`, **le gras** le sépare du corps — pas de 6ᵉ jeton de taille  |
| Sur la carte     | **titre + extrait** ; l'extrait recule en `--muted` quand un titre le suit |
| Carte sans titre | **inchangée** — une seule forme de carte, avec ou sans sa première ligne   |
| Recherche        | le titre est **cherché** comme le texte des variations                     |
| Chiffrement      | **scellé** par `store/notes.ts`, AAD = `user_id`, comme les notes          |
| Idées existantes | **aucune reprise** — elles restent sans titre jusqu'à ce qu'on les rouvre  |

La maquette interactive de l'affordance est `design/mockup-title.html`.

## Ce qui reste à trancher

**Le point d'entrée d'écriture.** `PATCH /ideas/{id}` existe, mais ne porte
aujourd'hui qu'une intention (`setIdeaLabel`) et refuse tout champ hors de son
schéma. Élargir cette opération ou donner au titre la sienne se décide avec le
reste de la conception de l'API.
