# Contrat API — idea-pipeline

> Mono-utilisateur · Contract-first

> En cas d'erreur inattendue côté serveur, toutes les requêtes renvoient **`500 - Erreur inattendue côté serveur`**.

## Format des erreurs

Toutes les réponses d'erreur (`400`, `404` et `500`) renvoient un corps JSON de la forme suivante :

```json
{
  "error": "Message décrivant l'erreur"
}
```

Exemples :

- `400` : `{ "error": "Le champ \"text\" est obligatoire." }`
- `404` : `{ "error": "Idée introuvable." }`
- `500` : `{ "error": "Erreur inattendue côté serveur." }`

| Action        | Méthode  | Endpoint                               | Pourquoi ce choix ?                                                                                                                                                                                                                                                              |
| ------------- | -------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| list          | `GET`    | `/ideas`                               | `GET` est utilisé pour récupérer une représentation d'une ressource sans la modifier. L'URL `/ideas` désigne la collection des idées.                                                                                                                                            |
| create        | `POST`   | `/ideas`                               | `POST` crée une nouvelle ressource dans la collection `/ideas`. Le serveur attribue l'identifiant de la nouvelle idée.                                                                                                                                                           |
| delete        | `DELETE` | `/ideas/{id}`                          | `DELETE` supprime la ressource identifiée par `{id}`. L'URL cible directement l'idée concernée.                                                                                                                                                                                  |
| addVariation  | `POST`   | `/ideas/{id}/variations`               | Une variation appartient à une idée. L'imbrication de l'URL exprime cette relation de possession. `POST` ajoute une nouvelle ressource à cette sous-collection.                                                                                                                  |
| editVariation | `PATCH`  | `/ideas/{id}/variations/{variationId}` | `PATCH` est utilisé car seule une partie de la variation est modifiée. L'URL cible directement la variation appartenant à l'idée.                                                                                                                                                |
| changeStatus  | `PATCH`  | `/ideas/{id}`                          | Le statut est un attribut de l'idée. `PATCH` permet une modification partielle de la ressource sans remplacer l'ensemble de ses champs. Le changement de statut est traité comme une mise à jour de la ressource, et non comme une action dédiée (`/publish`, `/archive`, etc.). |

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

**Réponse :** `200` + collection d'idées (`[]` si aucune idée n'existe).

Aucune donnée n'est envoyée à l'API : le client appelle simplement l'endpoint. Le corps de la réponse contient une collection JSON représentant les idées.

```json
[
  {
    "createdAt": "2026-07-08T02:45:30.790Z",
    "id": "5c6c75a2-9b9b-462a-983f-3ad74f664470",
    "status": "captured",
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
- `400` si `text` est absent, vide ou ne contient que des espaces.

### Delete idea

`DELETE /ideas/{id}` — Supprime une idée identifiée par son `id`.

**Requête :** aucune.

**Réponse :**

- `204` (sans corps). Après une suppression, la ressource n'existe plus ; renvoyer un corps vide est plus cohérent que d'inventer une représentation.
- `404` si l'identifiant est inconnu.

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
- `400` si `text` est absent, vide ou ne contient que des espaces.
- `404` si l'idée à modifier est introuvable.

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
- `400` si `text` est absent, vide ou ne contient que des espaces.
- `404` si l'idée ou la variation à modifier est introuvable.

### Change status

`PATCH /ideas/{id}` — Modifie le statut d'une idée.

**Requête :**

```json
{
  "status": "captured"
}
```

**Réponse :**

- `200` + l'idée mise à jour.
- `400` si le statut envoyé par le client n'est pas valide.
- `404` si l'idée à modifier est introuvable.

Le champ `status` accepte uniquement les valeurs suivantes :

- `captured`
- `maturing`
- `ready`
- `published`

Le corps de la requête doit contenir uniquement le champ `status`.

- `400` si le corps est vide.
- `400` si `status` est absent ou ne correspond pas à l'une des valeurs autorisées (`captured`, `maturing`, `ready`, `published`).
- `400` si un ou plusieurs champs non autorisés sont présents dans la requête.
-

## Décision : `GET /ideas`

**Décision : la collection complète est renvoyée.**

L'endpoint `GET /ideas` renvoie l'ensemble des idées, sans filtrage, tri ni pagination. Les besoins fonctionnels de l'application sont couverts par cette approche et le volume de données attendu reste faible. Les éventuels filtres, recherches ou tris sont réalisés côté client. Ajouter des paramètres de requête (`?status=`, `?sort=`, `?search=`…) constituerait une complexité inutile à ce stade (principe **YAGNI**).

## Décision : génération des identifiants

Les identifiants des idées et des variations sont générés exclusivement par le serveur. Le client ne fournit jamais de champ `id` lors d'une création.

Les opérations `POST` ne sont donc pas idempotentes : si une même requête est rejouée (par exemple après un timeout réseau), une nouvelle ressource peut être créée avec un nouvel identifiant. Ce comportement est conforme à la sémantique de `POST` et est accepté dans le contexte de cette application.
