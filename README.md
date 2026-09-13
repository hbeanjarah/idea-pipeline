# idea-pipeline

Extension Chrome perso de capture et de maturation d'idées de posts LinkedIn,
et l'API locale qui la servira.

Le dépôt tient **deux moitiés indépendantes** :

|                | Où        | Ce que c'est                                                          |
| -------------- | --------- | --------------------------------------------------------------------- |
| **Extension**  | `src/`    | Manifest V3, React, Side Panel. Persiste dans `chrome.storage.local`. |
| **API locale** | `server/` | Express 5 + PostgreSQL, sert le contrat de `docs/`.                   |

**Elles ne sont pas encore branchées** : l'extension n'appelle pas l'API. On peut
lancer l'une sans l'autre.

## Prérequis

- **Node** 24 ou plus
- **pnpm** 10 ou plus
- **Docker** — pour la base de données et pour la suite de tests du serveur

## Installation

Il n'y a **pas de workspace pnpm** : les deux moitiés s'installent séparément.

```bash
pnpm install                 # l'extension
pnpm --dir server install    # l'API
```

## Lancer l'API locale

Trois commandes, dans cet ordre. Il compte : régénérer les types contre une base
non migrée ne lève aucune erreur, mais produit une interface vide.

```bash
cp server/.env.example server/.env          # une seule fois
docker compose up -d --wait                 # démarre PostgreSQL
pnpm --dir server db:migrate                # applique le schéma
pnpm --dir server db:types                  # génère les types depuis la base
pnpm --dir server dev                       # http://localhost:3000
```

`db:types` écrit `server/src/store/schema.generated.ts`, qui n'est **pas
versionné**. Sans lui, `typecheck` échoue sur un clone neuf — c'est normal, il
suffit de lancer les deux commandes `db:*`.

Une fois le serveur démarré :

- **http://localhost:3000/docs** — documentation interactive (Scalar), avec un
  bouton pour appeler l'API depuis la page
- **http://localhost:3000/openapi.yaml** — la spécification brute

Pour arrêter : `Ctrl+C`, puis `docker compose down`. Les données survivent dans
un volume Docker ; `docker compose down -v` les supprime définitivement.

### Après avoir écrit une migration

```bash
pnpm --dir server db:migrate && pnpm --dir server db:types
```

## Lancer l'extension

```bash
pnpm dev       # ou : pnpm build
```

Puis dans Chrome :

1. ouvrir `chrome://extensions`
2. activer le **mode développeur**
3. **Charger l'extension non empaquetée** et choisir le dossier `dist/`

Le panneau s'ouvre par un clic sur l'icône ou par `Ctrl+Shift+Y`
(`Cmd+Shift+Y` sur macOS).

## Commandes

| Commande                  | Effet                                                                          |
| ------------------------- | ------------------------------------------------------------------------------ |
| `pnpm test`               | toute la suite — **exige Docker** (le serveur teste sur un conteneur éphémère) |
| `pnpm test:watch`         | la même, en continu                                                            |
| `pnpm typecheck`          | l'extension **et** l'API                                                       |
| `pnpm lint`               | ESLint sur tout le dépôt                                                       |
| `pnpm format`             | Prettier en écriture                                                           |
| `pnpm build`              | build de l'extension                                                           |
| `pnpm --dir server build` | build de l'API                                                                 |

La suite de tests démarre son **propre** conteneur PostgreSQL, distinct de celui
du Compose : lancer les tests ne touche jamais à la base de développement.

## Documentation

| Fichier                      | Contenu                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| `docs/api-design.md`         | le contrat REST, et la table exhaustive des messages d'erreur |
| `docs/openapi.yaml`          | la spécification OpenAPI — **source de vérité** du modèle     |
| `docs/persistence-design.md` | la conception de la persistance                               |
| `docs/persistence-plan.md`   | son plan d'implémentation                                     |
| `CLAUDE.md`                  | le cadre de travail, la pile, le hors-scope                   |
