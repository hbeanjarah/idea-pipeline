# Les touches d'écriture — conception

> `⏎` va à la ligne. `Ctrl+⏎` enregistre. Le raccourci caché passe sur le geste
> qui a déjà un bouton.

## Pourquoi

Deuxième retour de test :

> « Je ne sais pas comment aller à la ligne ; lorsque je fais entrée, ça
> sauvegarde directement la note. »

Le composer et l'éditeur de variation liaient tous deux `⏎` à l'enregistrement,
`Maj+⏎` au saut de ligne, et n'affichaient **rien** qui le dise. Trois fonctions
étaient cachées derrière ce silence : le saut de ligne, la continuation d'une
liste à puces (`Maj+⏎` dans une puce) et le démarrage d'une puce (`-` ou `*`
puis espace).

**L'échec n'était pas cosmétique.** `submit()` enregistre puis vide le champ :
quelqu'un qui sépare ses paragraphes avec `⏎` n'obtient pas une note mal
formatée, il obtient **autant d'idées que de paragraphes**. Le mode d'échec
produisait des fragments dans le pipeline.

Garder `⏎` et se contenter d'afficher une aide a été écarté : c'est mettre un
panneau devant le piège sans retirer le piège, et le coût reste payé par
quiconque arrive sans avoir lu le panneau. Le bouton ▶ du composer et les
boutons ✓/✗ de l'éditeur sont déjà visibles — **envoyer avait déjà son
affordance, aller à la ligne n'en avait aucune.**

## Décisions actées

| Sujet                | Décision                                                                |
| -------------------- | ----------------------------------------------------------------------- |
| `⏎` dans un textarea | **va à la ligne** — composer et éditeur de variation                    |
| Enregistrer          | `Ctrl+⏎`, et **`Cmd+⏎`** sur macOS — les deux, jamais l'un sans l'autre |
| Bouton               | reste l'affordance principale d'envoi, inchangé                         |
| Puces                | se continuent désormais sur **`⏎`**, la touche où on les attend         |
| `Échap`              | inchangé — annule dans l'éditeur, rien dans le composer                 |
| Aide                 | visible sous le champ : elle n'enseigne plus que le raccourci d'envoi   |

**`⏎` dans le champ de titre enregistre toujours** — voir `title-design.md`.
Ce n'est pas une exception à la règle, c'est la règle : `⏎` fait ce que la
nature du champ commande. Dans un champ d'une ligne, un saut de ligne n'existe
pas et `⏎` valide, comme dans tout formulaire ; dans un textarea, il va à la
ligne. Une seule chose à apprendre, et c'est celle que le web enseigne déjà.

## Ce qui reste à trancher

**La contradiction avec `interface-design.md`.** Ce document écrit la promesse
de capture sous la forme « un champ, `⏎`, c'est dedans ». Elle n'est plus vraie.
Il faut décider si ce document est amendé ou si celui-ci le remplace sur ce
point : une décision écrite à deux endroits se désynchronise.
