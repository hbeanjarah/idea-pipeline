# Authentification & sessions — conception

> Google OAuth · sessions opaques en base · cloisonnement par `user_id`
>
> **Périmètre : la moitié serveur uniquement.** L'extension et l'hébergement
> font l'objet de briques distinctes.

## Ce que cette brique change dans le projet

Elle retire trois décisions explicites, actées par le PO en amont :

| Où                  | Ce qui était écrit                                                | Ce qui le remplace                       |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `CLAUDE.md`         | « Outil **personnel, mono-utilisateur** »                         | produit multi-utilisateur                |
| `CLAUDE.md`         | « Aucun hébergement distant, aucun compte, aucun multi-appareil » | comptes Google, sessions multi-appareils |
| `docs/openapi.yaml` | `security: []` — l'absence d'auth y était _déclarée_              | schéma `bearer` sur tous les endpoints   |

Ce n'est pas un ajustement : `CLAUDE.md` change d'identité produit et sera
réécrit, pas amendé.

## Décisions actées

| Sujet                        | Décision                                                               |
| ---------------------------- | ---------------------------------------------------------------------- |
| Utilisateurs                 | **Plusieurs**, avec de vrais comptes                                   |
| Cloisonnement                | **Étanche** — une idée appartient à une personne, invisible aux autres |
| Méthode                      | **Google d'abord** ; e-mail + mot de passe dans une brique ultérieure  |
| Session                      | **Jeton opaque en base**, révocable — pas de JWT auto-porté            |
| Transport                    | En-tête `Authorization: Bearer`                                        |
| Réseau                       | **En ligne requis**, avec un _retry_ côté client                       |
| Hors ligne / synchronisation | **Reportés**, explicitement                                            |

### Pourquoi Google avant le mot de passe

L'ordre initialement envisagé était l'inverse. Google est la moitié la plus
simple **et** la moins risquée : aucun secret stocké, aucun e-mail à envoyer,
aucun parcours de réinitialisation. Commencer par le mot de passe, c'est attaquer
par la partie qui porte le plus de responsabilité et la plus longue chaîne de
dépendances — à commencer par la délivrabilité e-mail sur un hôte neuf.

### Pourquoi pas de JWT

Le besoin exprimé est exactement celui qu'un jeton auto-porté sert mal : voir ses
appareils connectés, en couper un, révoquer immédiatement. Un JWT reste valide
jusqu'à son expiration quoi qu'on fasse. Une ligne en base se supprime.

OWASP recommande par ailleurs l'identifiant **opaque**, sans signification, avec
l'état côté serveur et au moins 64 bits d'entropie.

## Le modèle

```sql
-- server/migrations/002_auth.sql

CREATE TABLE users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub  text        NOT NULL UNIQUE,
  email       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    text        NOT NULL UNIQUE,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Base de développement uniquement : rien n'est déployé, et ces lignes sont des
-- tests. Une migration destructrice serait inacceptable sur un système en
-- service — ne pas recopier ce DELETE ailleurs sans y réfléchir.
DELETE FROM ideas;

ALTER TABLE ideas ADD COLUMN user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE;
CREATE INDEX ideas_user_id_updated_at_idx ON ideas (user_id, updated_at DESC, id DESC);
DROP INDEX ideas_updated_at_idx;  -- plus aucune requête ne liste sans filtrer sur user_id
```

Ce que chaque choix défend :

- **`google_sub` est la clé d'identité, pas `email`.** Une adresse Google peut
  changer ; le `sub` non. Google le dit explicitement dans sa documentation.
  Indexer sur l'e-mail, c'est risquer de perdre un compte — ou d'en fusionner deux.
- **`token_hash`, jamais le jeton.** Si la base fuit, les sessions ne sont pas
  rejouables. Un **SHA-256 suffit** : le hachage lent (Argon2) protège les secrets
  à faible entropie choisis par un humain, pas un jeton de 256 bits tiré au sort.
- **`ideas_user_id_updated_at_idx`** remplace `ideas_updated_at_idx` : la requête
  de liste commence désormais par `WHERE user_id = $1`, l'index doit suivre.
- **`ON DELETE CASCADE` sur `ideas.user_id`** : supprimer un compte emporte ses
  idées. C'est la lecture stricte de « suppression = définitive ».
- **Le `DELETE FROM ideas`** est possible parce que rien n'est déployé et que la
  table ne contient que des lignes de test. PostgreSQL refuse d'ajouter une
  colonne `NOT NULL` sans défaut à une table peuplée, et `users` est créée vide
  par cette même migration : il n'existe aucun propriétaire à qui les attribuer.

## Le flux Google

```
Extension                     Serveur                      Google
    │  launchWebAuthFlow ─────────────────────────────────────▶
    │  ◀──────────────────────── code d'autorisation ──────────
    │
    │  POST /auth/google ─────────▶
    │    { code, code_verifier }   │ échange (client_secret) ─▶
    │                              │ ◀──── id_token ───────────
    │                              │ lit sub + email
    │                              │ crée ou retrouve le user
    │                              │ ouvre une session
    │  ◀──── { token, user } ──────┘
```

Deux faits vérifiés dans la documentation Google, qui dictent cette forme :

1. **L'échange exige le `client_secret`** pour un client « Web application ». Il
   ne peut donc pas se faire dans l'extension : le secret doit rester serveur.
2. **L'`id_token` obtenu ainsi n'a pas à être vérifié.** Le serveur l'a récupéré
   lui-même, en HTTPS, authentifié par son secret. La validation de signature
   n'est requise que si le jeton transite par un autre composant.

Conséquence : **aucune bibliothèque d'authentification n'est nécessaire.**
`fetch` est natif en Node 24, `node:crypto` fournit l'aléa et le hachage.

`launchWebAuthFlow` plutôt que `getAuthToken` : ce dernier est confortable mais
**exclusif à Chrome** et adossé au profil navigateur. Le premier est le flux
OAuth standard, celui-là même qu'une application mobile utilisera — un seul
chemin serveur pour les deux clients.

## La session

- **Jeton opaque**, 256 bits d'un CSPRNG, encodé base64url. Aucune signification.
- **Deux expirations** : par inactivité (`last_seen_at` rafraîchi à chaque
  requête authentifiée) et absolue (`expires_at`, fixée à la création).
- **Révocation** : supprimer la ligne. Effet immédiat, sur toutes les requêtes.
- **Une ligne par appareil.** Se connecter ailleurs n'invalide rien : c'est la
  définition même de « plusieurs navigateurs en même temps ».

Valeurs actées : **30 jours** d'expiration absolue, **7 jours** d'inactivité. Un outil de capture personnelle ne gagne rien à déconnecter
souvent ; la révocation couvre le cas où un appareil est perdu.

## L'API

### Endpoints nouveaux

| Endpoint               | Rôle                                             |
| ---------------------- | ------------------------------------------------ |
| `POST /auth/google`    | échange le code contre une session               |
| `GET /auth/me`         | qui suis-je — permet de détecter un jeton périmé |
| `DELETE /auth/session` | déconnexion de cet appareil                      |

`GET /auth/me` n'est pas du confort : sans lui, le client ne découvre l'expiration
qu'en échouant sur une requête métier.

### Ce que deviennent les six existants

Tous exigent une session valide. Et :

> **Une idée appartenant à quelqu'un d'autre renvoie `404`, jamais `403`.**

Un `403` révélerait l'existence d'idées d'autrui et rendrait les identifiants
énumérables. Le `404` ne dit rien — et il est gratuit : le store filtrant sur
`user_id`, l'idée d'un autre est littéralement introuvable. Le message
`Idée introuvable.` couvre le cas sans en ajouter un.

### Messages ajoutés au contrat

La table de `docs/api-design.md` se dit exhaustive ; elle passe de 9 à 12.

| Code  | Message                                    | Quand                                                                                   |
| ----- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `401` | `Authentification requise.`                | jeton absent, invalide, expiré ou révoqué — **un seul message**, pour ne rien divulguer |
| `400` | `Code d'autorisation invalide.`            | Google refuse l'échange du code                                                         |
| `502` | `Service d'authentification indisponible.` | Google injoignable — une panne, pas une faute du client                                 |

### Effet sur le lint du spec

Parmi les trois avertissements Redocly qu'on avait écartés,
`operation-4xx-response` visait `GET /ideas`, au motif qu'il ne pouvait pas
échouer. Avec l'authentification, il renvoie `401`. **L'avertissement devient
fondé** : il faudra le traiter, pas le taire.

## Le cloisonnement

```
middleware/auth  lit Authorization: Bearer, hache, cherche la session,
                 vérifie les deux expirations, rafraîchit last_seen_at
                 → attache userId à la requête, ou lève 401
        ↓
controllers/     lisent req.userId et le passent au service
        ↓
services/        le transmettent au store
        ↓
store/           WHERE user_id = $1 sur CHAQUE requête
```

### Les signatures du store changent

`listIdeas(userId)`, `createIdea(userId, text)`, et ainsi de suite pour les six.
La brique persistance se vantait de n'avoir touché aucun appelant ; celle-ci
touche les trois couches. C'est normal — l'identité est une donnée métier
transverse, pas un détail de stockage — mais autant le dire plutôt que de
prétendre que la frontière tient.

L'alternative — porter l'utilisateur implicitement via `AsyncLocalStorage` pour
garder les signatures — est **écartée**. Elle rend invisible le paramètre le plus
critique du système. Avec un paramètre explicite, oublier le cloisonnement **ne
compile pas** ; avec un contexte implicite, ça compile, ça passe les tests du cas
nominal, et ça fuit en production. Même règle que le `TRUNCATE` placé dans un
`beforeEach` global : un mécanisme oubliable en silence doit être rendu obligatoire.

### Row Level Security : pas maintenant

PostgreSQL sait imposer le cloisonnement lui-même : une politique RLS rend une
ligne d'autrui invisible même si le code oublie son `WHERE`. Le coût est une
variable de session à positionner par connexion, ce qui se marie mal avec un pool
recyclé entre utilisateurs.

Le filtrage explicite plus le test de sabotage couvrent le risque principal, et
RLS s'ajoute plus tard sans rien casser. L'option est consignée ici pour ne pas
être découverte après une fuite.

## Tests

Le harnais conteneurisé existant sert tel quel. Deux ajouts :

**Un fichier dédié au cloisonnement**, avec deux utilisateurs réels en base :

- A ne voit aucune idée de B dans `GET /ideas`
- A reçoit `404` — et non `403` — sur l'idée de B, pour les quatre endpoints
  prenant un `id`
- A ne peut pas ajouter de variation à une idée de B
- supprimer le compte A ne touche pas aux idées de B

**Prouvé par sabotage** : retirer un `WHERE user_id` doit faire tomber ce fichier.
Un test de cloisonnement qu'on n'a pas vu échouer ne prouve rien.

**Google est simulé.** Les tests ne peuvent pas appeler Google : l'échange du code
est isolé derrière une fonction que les tests remplacent. Ce qui est testé, c'est
tout ce qui est à nous — création du compte, ouverture de session, expirations,
révocation, `401`. L'échange réel se vérifie à la main, une fois, avec de vraies
clés.

## Dépendances

**Aucune.** `fetch` est natif, `node:crypto` fournit l'aléa et le hachage, et la
vérification de signature n'est pas requise.

En revanche, **deux choses que seul le PO peut fournir** :

- un **client OAuth Google** de type « Web application », dans la console Google
  Cloud, avec son `client_id` et son `client_secret` ;
- l'**URL de redirection** `https://<ID_EXTENSION>.chromiumapp.org/`, qui suppose
  un ID d'extension **stable** — donc une `key` fixée dans `src/manifest.ts`.

Ces valeurs vivent dans `server/.env`, jamais dans le dépôt.

## Hors périmètre

- **L'extension** : `launchWebAuthFlow`, stockage du jeton, _retry_. Brique
  suivante.
- **L'hébergement OVH** : domaine, HTTPS, secrets, sauvegardes. Brique à part.
- **E-mail + mot de passe** : brique ultérieure, conçue pour se brancher sur la
  même table `sessions`.
- **La liste « mes appareils »** et la déconnexion à distance : le modèle les
  permet, elles ne sont pas nécessaires ici.
- **Écriture hors ligne et synchronisation** : reportées, décision du PO.
- **Partage d'idées entre comptes** : hors modèle.
- **La reprise des idées du stockage local.** Décision PO : elles seront
  exportées, puis rattachées à un compte par un **script ponctuel**, une fois
  l'authentification fonctionnelle. Tant que ça reste un script de migration, le
  hors-scope « pas d'export » du `CLAUDE.md` n'est pas franchi ; il le serait si
  l'export devenait une fonctionnalité de l'interface.
- **RLS** : voir plus haut.

## Notes / Blocage

- **`docs/api-design.md` décrit encore une API sans authentification**, et le
  justifie par « outil mono-utilisateur ». Le fait reste vrai — il n'y a pas
  d'auth aujourd'hui — mais la justification est morte. Le contrat se met à jour
  **au début de l'implémentation**, avec `openapi.yaml`, pas avant : les
  désynchroniser serait pire que le décalage actuel.
- Le script de reprise du stockage local suppose une façon de lire
  `chrome.storage.local` hors de l'extension. À concevoir avec la brique
  extension, pas ici.
