# Contrat API — idea-pipeline

> Mono-utilisateur · Contract-first

> En cas d'erreur inattendue côté serveur, toutes les requêtes renvoient **`500 - Erreur inattendue côté serveur`**.

## Serveur & authentification

**Base URL** : `http://localhost:3000` tant que rien n'est hébergé. Tous les chemins ci-dessous sont relatifs à cette base.

**Session obligatoire.** Chaque requête porte un jeton de session opaque :

```
Authorization: Bearer <jeton>
```

Le jeton s'obtient par `POST /auth/google`, seul endpoint accessible sans session. Il est **révocable** : supprimer la session le rend invalide immédiatement, ce qu'un jeton auto-porté ne permet pas. Un compte peut avoir plusieurs sessions vivantes — une par appareil.

**Une idée appartient à un compte, et à un seul.** Une idée d'autrui répond **`404`, jamais `403`** : un `403` confirmerait son existence et rendrait les identifiants énumérables. Le message est le même que pour une idée inexistante, parce que c'est exactement ce qu'elle est pour l'appelant.

## Format des erreurs

Toutes les réponses d'erreur (`400`, `401`, `404`, `500` et `502`) renvoient un corps JSON de la forme suivante :

```json
{
  "error": "Message décrivant l'erreur"
}
```

### Messages

La liste est exhaustive : l'API n'en renvoie pas d'autres.

| Code  | Message                                    | Quand                                                                                                                                             |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400` | `Le champ "text" est obligatoire.`         | `text` absent, vide ou ne contenant que des espaces — y compris quand le corps n'a pas été lu du tout (`Content-Type: application/json` manquant) |
| `400` | `Le champ "labelId" est obligatoire.`      | `labelId` absent du corps, ou d'un type autre qu'une chaîne ou `null` — corps vide inclus                                                         |
| `400` | `Le nom de l'étape est obligatoire.`       | `name` absent, vide ou ne contenant que des espaces — corps non lu inclus                                                                         |
| `400` | `Le nom de l'étape est trop long.`         | `name` de plus de 32 caractères                                                                                                                   |
| `400` | `Cette étape existe déjà.`                 | le compte porte déjà ce nom — comparaison après `trim`, casse ignorée, accents **non** repliés (« Prêt » ≠ « Pret »)                              |
| `400` | `La liste des étapes est incomplète.`      | `ids` n'est pas exactement l'ensemble des étapes du compte                                                                                        |
| `400` | `Champs non autorisés.`                    | au moins un champ hors du schéma est présent                                                                                                      |
| `400` | `Corps de requête JSON invalide.`          | JSON malformé                                                                                                                                     |
| `404` | `Idée introuvable.`                        | l'`id` ne correspond à aucune idée                                                                                                                |
| `404` | `Variation introuvable.`                   | l'idée existe, mais pas la variation ciblée                                                                                                       |
| `404` | `Étape introuvable.`                       | l'`id` ne correspond à aucune étape **de ce compte** — jamais `403`, on ne divulgue pas son existence                                             |
| `404` | `Ressource introuvable.`                   | l'URL ne correspond à aucun endpoint                                                                                                              |
| `401` | `Authentification requise.`                | jeton absent, invalide, expiré ou révoqué — **un seul message**, pour ne rien divulguer                                                           |
| `400` | `Code d'autorisation invalide.`            | corps de `POST /auth/google` invalide, ou code refusé par Google                                                                                  |
| `502` | `Service d'authentification indisponible.` | Google injoignable — une panne, pas une faute du client                                                                                           |
| `500` | `Erreur inattendue côté serveur.`          | toute erreur non prévue                                                                                                                           |

Le texte est repris **mot pour mot** côté serveur : le contrat fait foi.

| Action        | Méthode  | Endpoint                               | Pourquoi ce choix ?                                                                                                                                                                                                                                                                                                        |
| ------------- | -------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| list          | `GET`    | `/ideas`                               | `GET` est utilisé pour récupérer une représentation d'une ressource sans la modifier. L'URL `/ideas` désigne la collection des idées.                                                                                                                                                                                      |
| create        | `POST`   | `/ideas`                               | `POST` crée une nouvelle ressource dans la collection `/ideas`. Le serveur attribue l'identifiant de la nouvelle idée.                                                                                                                                                                                                     |
| delete        | `DELETE` | `/ideas/{id}`                          | `DELETE` supprime la ressource identifiée par `{id}`. L'URL cible directement l'idée concernée.                                                                                                                                                                                                                            |
| addVariation  | `POST`   | `/ideas/{id}/variations`               | Une variation appartient à une idée. L'imbrication de l'URL exprime cette relation de possession. `POST` ajoute une nouvelle ressource à cette sous-collection.                                                                                                                                                            |
| editVariation | `PATCH`  | `/ideas/{id}/variations/{variationId}` | `PATCH` est utilisé car seule une partie de la variation est modifiée. L'URL cible directement la variation appartenant à l'idée.                                                                                                                                                                                          |
| setIdeaLabel  | `PATCH`  | `/ideas/{id}`                          | L'étape est un attribut de l'idée. `PATCH` permet une modification partielle sans remplacer l'ensemble des champs. Le classement est traité comme une mise à jour de la ressource, et non comme une action dédiée (`/publish`, `/archive`…). Détacher n'a pas d'endpoint propre : `null` est une valeur du champ.          |
| listLabels    | `GET`    | `/labels`                              | `GET` récupère la collection des étapes du compte, sans la modifier.                                                                                                                                                                                                                                                       |
| createLabel   | `POST`   | `/labels`                              | `POST` ajoute une ressource à la collection. Le serveur attribue l'identifiant, la position et la couleur.                                                                                                                                                                                                                 |
| reorderLabels | `PATCH`  | `/labels`                              | Le `PATCH` porte sur la **collection**, pas sur un élément : déplacer une étape renumérote toutes les autres. Des `PATCH /labels/{id}` successifs s'entrelaceraient en ordres incohérents. `PUT /labels/order` a été écarté — ce chemin entre en collision avec `/labels/{id}`, où `order` serait lu comme un identifiant. |
| renameLabel   | `PATCH`  | `/labels/{id}`                         | `PATCH` car seul le nom change. L'URL cible l'étape.                                                                                                                                                                                                                                                                       |
| deleteLabel   | `DELETE` | `/labels/{id}`                         | `DELETE` supprime la ressource. Les idées qui la portaient deviennent libres ; aucune n'est supprimée.                                                                                                                                                                                                                     |

## Décisions de conception

- **PUT vs PATCH** : `PATCH` est retenu, car seules certaines propriétés d'une ressource sont modifiées. `PUT` impliquerait le remplacement complet de la représentation.
- **Ressource vs action** : l'API manipule des ressources (`/ideas`) plutôt que des verbes (`/publish`, `/changeStatus`). Les changements d'état sont considérés comme des mises à jour de la ressource.
- **Imbrication** : les variations n'existent que dans le contexte d'une idée. L'URL `/ideas/{id}/variations` exprime cette relation de possession.

## Décision : `GET /ideas/{id}`

**Décision : non retenue.**

L'application ne prévoit pas la consultation individuelle d'une idée. Les besoins fonctionnels sont couverts par `GET /ideas`, qui renvoie la collection complète. Ajouter `GET /ideas/{id}` introduirait un endpoint inutilisé, ce qui irait à l'encontre du principe **YAGNI** (_You Aren't Gonna Need It_).

## Modèle des requêtes et des réponses

### List ideas

`GET /ideas` — Liste des idées.

**Requête :** aucune.

**Réponse :** `200` + collection d'idées (`[]` si aucune idée n'existe), triée par `updatedAt` décroissant puis `id` décroissant.

Aucune donnée n'est envoyée à l'API : le client appelle simplement l'endpoint. Le corps de la réponse contient une collection JSON représentant les idées.

```json
[
  {
    "createdAt": "2026-07-08T02:45:30.790Z",
    "id": "5c6c75a2-9b9b-462a-983f-3ad74f664470",
    "labelId": null,
    "updatedAt": "2026-07-08T02:45:30.790Z",
    "variations": [
      {
        "createdAt": "2026-07-08T02:45:30.790Z",
        "id": "1c3a01e4-180e-493a-8c15-614231ba8bc6",
        "text": "Règle de la conception API : ne jamais faire confiance au client"
      }
    ]
  }
]
```

### Create idea

`POST /ideas` — Crée une nouvelle ressource `Idea`.

**Requête :**

```json
{
  "text": "Règle de la conception API : ne jamais faire confiance au client"
}
```

**Réponse :**

- `201` + l'idée qui vient d'être créée.
- `400` — `Le champ "text" est obligatoire.` si `text` est absent, vide ou ne contient que des espaces.
- `400` — `Champs non autorisés.` si un champ hors schéma est présent.

### Delete idea

`DELETE /ideas/{id}` — Supprime une idée identifiée par son `id`.

**Requête :** aucune.

**Réponse :**

- `204` (sans corps). Après une suppression, la ressource n'existe plus ; renvoyer un corps vide est plus cohérent que d'inventer une représentation.
- `404` — `Idée introuvable.` si l'identifiant est inconnu.

### Add new variation

`POST /ideas/{id}/variations` — Ajoute une variation à une idée.

**Requête :**

```json
{
  "text": "Règle de la conception API : ne jamais faire confiance au client"
}
```

**Réponse :**

- `201` + l'idée complète avec l'ensemble de ses variations. Ce choix reste cohérent avec les méthodes de mutation du repository, qui renvoient déjà un objet `Idea`. Le client récupère ainsi l'état complet sans avoir à le recomposer.
- `400` — `Le champ "text" est obligatoire.` si `text` est absent, vide ou ne contient que des espaces.
- `400` — `Champs non autorisés.` si un champ hors schéma est présent.
- `404` — `Idée introuvable.` si l'idée ciblée n'existe pas.

### Edit existing variation

`PATCH /ideas/{id}/variations/{variationId}` — Modifie le texte d'une variation existante.

**Requête :**

```json
{
  "text": "Règle de la conception API : ne jamais faire confiance au client"
}
```

**Réponse :**

- `200` + l'idée complète. Il ne s'agit pas d'une création (`201`), mais d'une modification. Le retour de l'idée entière permet de rester cohérent avec les autres opérations de mutation.
- `400` — `Le champ "text" est obligatoire.` si `text` est absent, vide ou ne contient que des espaces.
- `400` — `Champs non autorisés.` si un champ hors schéma est présent.
- `404` — `Idée introuvable.` si l'`id` ne correspond à aucune idée.
- `404` — `Variation introuvable.` si l'idée existe mais pas la variation ciblée.

Les deux causes sont distinguées : un seul message couvrant les deux ne
permettrait pas de savoir laquelle des deux ressources manque.

### Set idea label

`PATCH /ideas/{id}` — Classe une idée à une étape, ou l'en détache.

**Requête :**

```json
{
  "labelId": "8f3a1c60-4b2e-4d91-9a7f-0e5d2c8b1a34"
}
```

`null` détache l'idée. Il n'y a pas d'endpoint séparé pour ça : une idée sans
étape est un état légal du modèle, pas une opération à part.

**Réponse :**

- `200` + l'idée mise à jour.
- `400` si le corps est invalide.
- `404` — `Idée introuvable.` si l'idée n'existe pas ou appartient à un autre compte.
- `404` — `Étape introuvable.` si `labelId` ne désigne aucune étape **de ce compte**.

Le corps doit contenir uniquement le champ `labelId`.

- `400` — `Le champ "labelId" est obligatoire.` si `labelId` est absent, ou n'est ni une chaîne ni `null` — corps vide inclus.
- `400` — `Champs non autorisés.` si un ou plusieurs champs hors schéma sont présents.

L'appartenance de l'étape est vérifiée **avant** l'écriture. Laissée à la clé
étrangère, une étape inconnue remonterait en `500`, et celle d'un autre compte
serait acceptée en silence.

## Décision : `GET /ideas`

**Décision : la collection complète est renvoyée, triée par le serveur.**

L'endpoint `GET /ideas` renvoie l'ensemble des idées, sans filtrage ni pagination. Le volume attendu reste faible ; filtres et recherche sont réalisés côté client. Ajouter des paramètres de requête (`?labelId=`, `?search=`…) constituerait une complexité inutile à ce stade (principe **YAGNI**).

**Le tri, lui, appartient au serveur** : `updated_at` décroissant, l'idée touchée le plus récemment en premier. C'est ce qu'attend la section « Récentes » de l'accueil. Le laisser au client obligerait chaque consommateur à réimplémenter la même règle, et à se tromper de la même façon.

**Départage des égalités** : deux idées peuvent porter le même `updatedAt` — deux mutations dans la même milliseconde suffisent. L'`id` décroissant sert alors de second critère. Arbitraire, mais **déterministe** : sans lui, l'ordre varierait d'un appel à l'autre.

Ordre complet : `updatedAt DESC, id DESC`.

## Décision : génération des identifiants

Les identifiants des idées et des variations sont générés exclusivement par le serveur. Le client ne fournit jamais de champ `id` lors d'une création.

Les opérations `POST` ne sont donc pas idempotentes : si une même requête est rejouée (par exemple après un timeout réseau), une nouvelle ressource peut être créée avec un nouvel identifiant. Ce comportement est conforme à la sémantique de `POST` et est accepté dans le contexte de cette application.
