# idea-pipeline

Extension Chrome de capture et de maturation d'idées de posts LinkedIn, et
l'API multi-utilisateur qui la sert.

Le dépôt tient **deux moitiés** :

|                | Où        | Ce que c'est                                                             |
| -------------- | --------- | ------------------------------------------------------------------------ |
| **Extension**  | `src/`    | Manifest V3, React, Side Panel. Lit et écrit par son **service worker**. |
| **API locale** | `server/` | Express 5 + PostgreSQL, sert le contrat de `docs/`.                      |

**Elles sont branchées** : le panneau ne touche pas au réseau et ne voit jamais
le jeton de session — le service worker en est le seul détenteur. On se connecte
avec un **compte Google** ; chaque pipeline est étanche.

L'extension a donc besoin de l'API pour fonctionner. Elle n'a **pas** de mode
hors ligne : sans serveur, l'interface propose de réessayer.

## Prérequis

- **Node** 24 ou plus
- **pnpm** 10 ou plus
- **Docker** — pour la base de données et pour la suite de tests du serveur
- Un **client OAuth Google** de type _Web application_ — voir « Connexion
  Google » plus bas

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
cp server/.env.example server/.env          # une seule fois, puis le remplir
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

### La clé de chiffrement des notes

`server/.env` doit contenir `NOTE_KEY_V1`, sans quoi **l'API refuse de
démarrer** :

```bash
openssl rand -base64 32
```

Elle chiffre le contenu des notes avant qu'il n'atteigne PostgreSQL : un
`SELECT text FROM variations` ne renvoie que des valeurs préfixées `v1.`. La
conception est dans `docs/security-design.md`.

> **La perdre, c'est perdre toutes les notes.** Aucune restauration n'est
> possible sans elle. Elle se sauvegarde ailleurs que sur la machine, et
> **jamais dans la même sauvegarde que la base** — les deux réunies annulent
> tout le bénéfice.

Une clé de **développement** et une clé de **production** sont deux clés
distinctes. Ne jamais réutiliser l'une pour l'autre : chiffrer la base de prod
avec la clé de dev revient à la publier.

### Reprendre des notes écrites avant le chiffrement

```bash
pnpm --dir server db:seal
```

Idempotent : une ligne déjà chiffrée est comptée, pas retouchée. Le script
**s'arrête** s'il trouve une ligne préfixée `v1.` qui refuse de s'ouvrir — c'est
le signe que `NOTE_KEY_V1` n'est pas la clé qui a servi à l'écrire, et la
rechiffrer par-dessus serait sans retour.

### Après avoir écrit une migration

```bash
pnpm --dir server db:migrate && pnpm --dir server db:types
```

## Lancer l'extension

```bash
cp .env.example .env    # une seule fois, puis y mettre VITE_GOOGLE_CLIENT_ID
pnpm dev                # ou : pnpm build
```

Puis dans Chrome :

1. ouvrir `chrome://extensions`
2. activer le **mode développeur**
3. **Charger l'extension non empaquetée** et choisir le dossier `dist/`

Le panneau s'ouvre par un clic sur l'icône ou par `Ctrl+Shift+Y`
(`Cmd+Shift+Y` sur macOS).

> **Si le raccourci ne répond pas**, il n'est probablement pas attribué. Chrome
> n'applique `suggested_key` qu'**à l'installation** : une extension chargée
> avant que le manifeste ne déclare la commande, ou une combinaison déjà prise à
> ce moment-là, et la touche reste vide — sans un mot. Un rechargement ne
> rattrape rien. Aller dans `chrome://extensions/shortcuts`, et la saisir à la
> main.
>
> La colonne **Scope** y vaut « In Chrome » par défaut : le raccourci n'existe
> alors que si Chrome a le focus. La passer à **Global** le rend joignable
> depuis n'importe quelle application — c'est ce qui fait la capture immédiate.

**Il se redimensionne**, en tirant sur son bord, d'environ 320 à 1000 px — et
l'interface s'adapte. Au-delà de **750 px**, la liste et le détail s'affichent
côte à côte ; en dessous, un seul volet à la fois, celui que la sélection
désigne. C'est la première chose qu'un nouvel arrivant ne devine pas : ouvert
étroit, l'outil paraît deux fois plus pauvre qu'il ne l'est.

`VITE_GOOGLE_CLIENT_ID` est substitué **à la compilation** : après l'avoir
changé, il faut relancer `pnpm build` et recharger l'extension. Le serveur, lui,
lit son `.env` **au démarrage** — le redémarrer suffit, `tsx watch` ne recharge
pas l'environnement.

## Connexion Google

L'extension ouvre la fenêtre de consentement avec `launchWebAuthFlow` + PKCE, et
le **serveur** échange le code : le `client_secret` ne quitte jamais `server/`.
Conception détaillée dans `docs/google-signin-design.md`.

### L'identité de l'extension

`src/manifest.ts` contient une **`key`**, la clé publique d'une paire RSA dont la
privée vit dans `key.pem`, à la racine, **non versionné**. Elle fixe l'ID de
l'extension, sans quoi Chrome le dérive du chemin du dossier et l'URL de
redirection déclarée chez Google cesse de correspondre.

```bash
# L'ID que la key produit, pour le déclarer chez Google :
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null \
  | sha256sum | head -c 32 | tr '0-9a-f' 'a-p'; echo
```

**Ne perds pas `key.pem`** : sans lui, impossible de reproduire cet ID ailleurs.

### Côté Google Cloud

Dans **Google Auth Platform** (`console.cloud.google.com/auth`) :

1. **Branding** — nom de l'application, e-mail d'assistance, cible **Externe**
2. **Accès aux données** — les champs `openid` et `.../auth/userinfo.email`
3. **Audience → Utilisateurs tests** — **ajouter son adresse** : une application
   externe en statut _Testing_ n'autorise qu'eux, et le refus arrive côté Google,
   sans rien laisser dans nos journaux
4. **Clients → Créer un client** — type **Application Web**, aucune origine
   JavaScript, et une URI de redirection **avec sa barre oblique finale** :
   `https://<ID>.chromiumapp.org/`

Puis reporter le **même** `client_id` dans `server/.env` et `.env`, et le secret
dans `server/.env` **seulement** — un préfixe `VITE_` l'embarquerait dans le
bundle.

## Production

L'API est hébergée sur un VPS OVH et servie en HTTPS par Caddy :

```
https://api.hevinote.duckdns.org
```

**Cette adresse est provisoire.** Aucun domaine n'est acheté ; le sous-domaine
DuckDNS lève l'obstacle du certificat sans rien dépenser. Le jour où un vrai
domaine arrive, quatre choses changent et rien d'autre : un enregistrement `A`,
une ligne du `Caddyfile`, `VITE_API_URL` et un `pnpm build`. Détail dans
`docs/hosting-plan.md`.

### Déployer

Il n'y a pas de déploiement automatique — c'est un `git pull` à la main, décidé
comme tel. Sur le VPS :

```bash
cd /srv/idea-pipeline
git pull
pnpm install && pnpm --dir server install
pnpm --dir server db:migrate
pnpm --dir server db:types
pnpm --dir server build
sudo systemctl restart idea-pipeline
```

`db:types` régénère les types depuis la base : l'ordre compte, régénérer avant
d'avoir migré produit une interface `DB` vide sans lever la moindre erreur.

### Voir ce qui se passe

```bash
sudo systemctl status idea-pipeline --no-pager
journalctl -u idea-pipeline -f
```

### Les sauvegardes

`/srv/idea-pipeline/backup.sh` tourne à 3 h du matin par `cron`. Il écrit un
`pg_dump` gzippé dans `/var/backups/idea-pipeline/` et efface ce qui dépasse
**quatorze jours** — assez pour remarquer une corruption, assez peu pour tenir
sur le disque sans surveillance.

Le script **n'est pas versionné** : il porte des chemins propres à cette
machine. S'il est perdu, il se réécrit depuis `docs/hosting-plan.md`.

Restaurer un dump dans une base jetable, pour vérifier qu'il en est bien un :

```bash
cd /srv/idea-pipeline
docker compose exec -T db createdb -U idea restore_test
gunzip -c /var/backups/idea-pipeline/<date>.sql.gz \
  | docker compose exec -T db psql -U idea -d restore_test
docker compose exec -T db psql -U idea -d restore_test -c 'SELECT count(*) FROM ideas;'
docker compose exec -T db dropdb -U idea restore_test
```

> Les notes et les noms d'étapes sont **scellés** dans le dump, et les jetons de
> session n'y figurent que hachés. Restent en clair l'adresse e-mail du compte
> et les dates.

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

| Fichier                        | Contenu                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `docs/api-design.md`           | le contrat REST, et la table exhaustive des messages d'erreur   |
| `docs/openapi.yaml`            | la spécification OpenAPI — **source de vérité** du modèle       |
| `docs/persistence-design.md`   | la conception de la persistance                                 |
| `docs/auth-design.md`          | comptes, sessions révocables, cloisonnement                     |
| `docs/security-design.md`      | le chiffrement des notes au repos                               |
| `docs/labels-design.md`        | les étapes configurables : une par idée, renommables, ordonnées |
| `docs/front-api-design.md`     | la liaison panneau ↔ service worker ↔ API                       |
| `docs/google-signin-design.md` | la connexion Google, côté extension                             |
| `CLAUDE.md`                    | le cadre de travail, la pile, le hors-scope                     |

Chaque conception est suivie de son plan d'implémentation (`*-plan.md`).
