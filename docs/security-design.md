# Sécurité des notes — conception

> Première brique : rendre le contenu des notes illisible **dans la base**, sans
> rien changer au modèle, au contrat, ni au front.

## Pourquoi

Aujourd'hui `variations.text` contient le texte en clair. Quiconque obtient la
base l'obtient lisible : un `pg_dump` égaré, un disque de VPS déclassé, une
sauvegarde recopiée au mauvais endroit, une injection SQL qui lit des lignes.

Cette brique ferme ce vecteur-là. **Elle ne ferme pas les autres**, et la
section « Ce qu'elle ne protège pas » est à lire avant tout le reste : s'en
croire protégé serait pire que de ne rien faire.

## Décisions actées

| Sujet           | Décision                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| Portée          | **`variations.text` seul** — rien d'autre ne change                      |
| Où              | couche **store** (`server/src/store/ideas.ts`), nulle part ailleurs      |
| Algorithme      | **AES-256-GCM** via `node:crypto` — **zéro dépendance**                  |
| Clé             | 32 octets aléatoires, dans `server/.env`, `chmod 600`, jamais versionnée |
| Format stocké   | `v1.` + base64 de `IV ‖ tag ‖ chiffré`                                   |
| Liaison         | **AAD = l'`id` de l'idée** — un chiffré ne peut pas changer de ligne     |
| Rotation        | préfixe de version ; `NOTE_KEY_V2` cohabite avec `NOTE_KEY_V1`           |
| Journal d'accès | **abandonné** — voir « Une idée écartée »                                |

## Ce qu'elle protège, et ce qu'elle ne protège pas

| Scénario                                              | Couvert |
| ----------------------------------------------------- | ------- |
| Un `pg_dump` qui fuit (fichier, stockage objet, mail) | **oui** |
| Un disque de VPS volé ou déclassé                     | **oui** |
| Une injection SQL qui lit des lignes                  | **oui** |
| Un accès en lecture à la base (réplique, supervision) | **oui** |
| Une lecture **par l'application**                     | non     |
| Un shell sur le VPS (la clé y est aussi)              | non     |
| **Toi**                                               | **non** |

**À dire clairement :** après cette brique, un `SELECT` sur la base ne montre
plus rien de lisible — mais **l'application, elle, déchiffre toujours**. Avec un
accès à la machine, le contenu reste atteignable. Rendre la lecture impossible
_même pour l'exploitant_ demande la couche cliente, qui est une autre brique et
une autre décision.

## Pourquoi dans l'application et pas dans PostgreSQL

Trois voies existent. Une seule tient l'objectif.

| Voie                          | Verdict                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pgcrypto`                    | **non** — la clé voyage dans l'ordre SQL, donc dans `pg_stat_activity` et dans les journaux de requêtes |
| TDE natif                     | **non** — absent de PostgreSQL 17 standard (réservé aux forks)                                          |
| Chiffrement disque (LUKS)     | **non** — protège un disque volé, **pas un fichier de `pg_dump`**, qui est justement le vecteur visé    |
| **Applicatif, `node:crypto`** | **oui** — la clé ne quitte jamais le processus Node                                                     |

## Le mécanisme

```
texte clair ──AES-256-GCM(clé, IV aléatoire, AAD = idea_id)──► chiffré + tag

stocké :  "v1." + base64( IV(12o) ‖ tag(16o) ‖ chiffré )
```

- **GCM et pas CBC** : GCM est _authentifié_. Une ligne modifiée en base ne
  déchiffre pas — elle lève une erreur. CBC déchiffrerait du n'importe quoi en
  silence.
- **IV aléatoire de 12 octets à chaque écriture.** Jamais réutilisé : en GCM, un
  IV rejoué avec la même clé casse la confidentialité. 12 octets est la taille
  recommandée, et le nombre d'écritures possibles avant collision dépasse de
  très loin l'échelle de ce produit.
- **AAD = l'`id` de l'idée.** Le chiffré est lié à sa ligne : recopier la
  variation d'un compte dans l'idée d'un autre produit une erreur de
  déchiffrement au lieu d'une fuite. L'`id` est connu de l'application sur les
  trois chemins d'écriture, donc rien à changer au schéma.

## La clé

Un secret de 32 octets dans `server/.env`, à côté de `DATABASE_URL` et de
`GOOGLE_CLIENT_SECRET` — **la discipline existe déjà** : posé à la main,
`chmod 600`, jamais versionné, jamais écrit dans cette conversation.

```
NOTE_KEY_V1=<32 octets aléatoires en base64>
```

**Perdre cette clé, c'est perdre toutes les notes.** Elle doit être sauvegardée
ailleurs que sur le VPS, et **jamais dans la même sauvegarde que la base** —
sinon la fuite qu'on cherche à rendre inoffensive redevient lisible.

## La rotation

Le préfixe `v1.` n'est pas décoratif. Sans lui, changer de clé imposerait de
tout re-chiffrer d'un coup, donc on ne le ferait jamais.

Avec : `NOTE_KEY_V2` s'ajoute, les écritures utilisent la plus récente, les
lectures choisissent d'après le préfixe. Les anciennes lignes migrent quand
elles sont réécrites, ou par un passage dédié.

## Ce qui n'est pas chiffré, et pourquoi

| Donnée                     | Pourquoi elle reste lisible                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `status`                   | quatre valeurs fixes du domaine, pas du contenu — **change quand il deviendra configurable** |
| `created_at`, `updated_at` | le serveur trie dessus (`ideas_user_id_updated_at_idx`)                                      |
| `position`                 | l'ordre des variations, contrainte d'unicité                                                 |
| `users.email`              | nécessaire à l'authentification                                                              |
| **la taille du chiffré**   | AES-GCM ne masque pas la longueur                                                            |

Restent donc visibles : combien d'idées, quand, retravaillées combien de fois,
et à peu près leur longueur. **C'est peu, et ce sont des données personnelles.**

## Une idée écartée

J'avais proposé un journal d'accès en ajout seul, pour qu'une lecture laisse une
trace. **Je la retire.** Dans cette architecture l'application déchiffre à
chaque lecture légitime : le journal enregistrerait surtout du bruit et
donnerait l'illusion d'une redevabilité qu'il n'apporte pas. Ce qui compte
vraiment est plus simple : aucun clair dans les journaux, et la clé hors de la
base.

## Ce que ça change dans le code

| Fichier                     | Changement                                         |
| --------------------------- | -------------------------------------------------- |
| `server/src/config/env.ts`  | lire et valider `NOTE_KEY_V1`                      |
| `server/src/store/notes.ts` | **nouveau** — `seal()` / `open()`                  |
| `server/src/store/ideas.ts` | chiffrer aux 3 écritures, déchiffrer dans `toIdea` |
| `server/.env.example`       | documenter la variable                             |

**Inchangés :** le schéma, `docs/openapi.yaml`, les services, les contrôleurs,
les routes, et **tout le front**. Le chiffrement est un détail de persistance —
c'est exactement ce que la couche `store/` est là pour absorber.

Le `CHECK (btrim(text) <> '')` reste valide (un chiffré n'est jamais vide), mais
il ne valide plus la saisie : c'est le schéma Zod du service qui le fait, **sur
le clair, avant chiffrement**. L'ordre des couches ne bouge pas.

## L'ordre : avant `backup.sh`

La brique d'hébergement en attente installe un `pg_dump` quotidien avec
rotation sur 14 jours. **Fait après celle-ci, il produit des fichiers
inoffensifs. Fait avant, il fabrique 14 copies du clair.**

Cette brique passe donc devant.

## Les données existantes

Les idées déjà en base sont en clair. Un script de reprise les lit et les
réécrit chiffrées, **idempotent** : une ligne déjà préfixée `v1.` est sautée,
donc le script peut être relancé sans dégât.

À faire base arrêtée côté écriture, et après une sauvegarde — la seule fois où
un `pg_dump` en clair est justifié, et il se détruit juste après.

## Tests

| Quoi                                  | Comment                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Aller-retour                          | `open(seal(t)) === t`, y compris accents, emojis, retours à la ligne                                    |
| Détection de modification             | un octet changé ⇒ l'ouverture lève                                                                      |
| Liaison à la ligne                    | ouvrir avec un autre `idea_id` ⇒ lève                                                                   |
| Deux chiffrés du même texte diffèrent | preuve que l'IV est neuf à chaque fois                                                                  |
| **La base ne contient pas le clair**  | intégration : créer une idée, puis `SELECT text` brut et vérifier qu'il ne contient pas le texte soumis |
| Reprise idempotente                   | deux passages ⇒ même résultat                                                                           |

Le test d'intégration est le garde-fou : il échoue le jour où quelqu'un ajoute
un chemin d'écriture qui contourne le chiffrement.

## Ce que cette brique laisse pour plus tard

- **La couche cliente** (chiffrement de bout en bout) — c'est elle qui te
  retirerait la lecture. Décision ouverte, à prendre avant deux jalons : le
  statut configurable, et le premier utilisateur qui n'est pas toi.
- **Le statut configurable**, qui fera basculer `status` du côté du contenu.
- **Le relais IA** sans stockage.
- L'export, qui devient l'assurance de l'utilisateur dès qu'il détient la clé.

## Definition of Done

1. `NOTE_KEY_V1` lue et validée au démarrage ; l'API refuse de démarrer sans.
2. Les trois écritures chiffrent, la lecture déchiffre, le front ne voit aucune
   différence.
3. Un `SELECT text FROM variations` ne renvoie que des `v1.…`.
4. Le script de reprise a converti l'existant, et rejouer le script ne fait rien.
5. `lint`, `typecheck`, `test`, `build` verts, test d'intégration inclus.
6. `README.md` documente la variable et **le fait que perdre la clé perd tout**.
