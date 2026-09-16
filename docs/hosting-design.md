# Hébergement — conception

> VPS OVH · Node sous `systemd` · PostgreSQL en conteneur · Caddy

## Pourquoi

C'est le dernier « décidé mais pas construit » du projet. L'API tourne sur
`localhost`, donc le produit ne tient pas sa promesse : **se connecter depuis
plusieurs navigateurs à la fois**, puis depuis une application mobile. Tant que
le serveur vit sur une machine de développement, il n'y a qu'un seul appareil.

## Décisions actées

| Sujet       | Décision                                                              |
| ----------- | --------------------------------------------------------------------- |
| Machine     | Le **VPS OVH existant** — VPS-2 2027, Ubuntu, 4 vCores, 8 Go, SBG     |
| L'API       | **Node compilé sur la machine**, lancé par **`systemd`**              |
| La base     | **PostgreSQL 17 en conteneur**, le `docker-compose.yml` du dépôt      |
| HTTPS       | **Caddy** — certificat Let's Encrypt obtenu et renouvelé tout seul    |
| Déploiement | **`git pull` + build sur la machine**, à la main                      |
| Sauvegardes | celle d'OVH (la VM entière) **plus un `pg_dump` quotidien**           |
| Nom d'hôte  | **`api.hevinote.duckdns.org`** (DuckDNS, gratuit) → `152.228.136.127` |
| Secrets     | un `server/.env` posé à la main, `chmod 600`, jamais versionné        |

### Pourquoi `systemd` plutôt qu'un conteneur pour l'API

Le déploiement choisi est `git pull` + build. Construire une image à chaque
déploiement ajouterait un Dockerfile, un registre ou un build local, et quelques
minutes de CPU — pour lancer le même `node dist/index.js`. `systemd` le
redémarre au boot et après un plantage, et range les journaux dans `journalctl`.

Le conteneur reste là où il apporte quelque chose : **PostgreSQL**, dont il évite
d'installer et de versionner une instance système.

### Pourquoi Caddy

Il obtient et renouvelle le certificat sans configuration. Le fichier entier fait
trois lignes. `nginx` + `certbot` produirait le même résultat avec deux outils,
un cron de renouvellement et dix fois plus de configuration.

## Trois défauts à réparer **avant** de déployer

Ils sont sans conséquence en local et graves sur une machine publique.

### 1. La base est publiée sur toutes les interfaces

```yaml
ports:
  - '5432:5432' # ← se lie à 0.0.0.0
```

Sur un VPS, cela expose PostgreSQL à Internet — avec le mot de passe `idea`.
Il faut `'127.0.0.1:5432:5432'`. Le pare-feu le bloquerait aussi, mais une
défense qui repose sur une seule barrière n'en est pas une.

### 2. L'API écoute sur toutes les interfaces

`app.listen(env.port)` se lie à `0.0.0.0` : le port 3000 serait joignable
directement, **en clair**, court-circuitant Caddy et son HTTPS. L'API doit
écouter sur `127.0.0.1` — seul Caddy, sur la même machine, a besoin de
l'atteindre.

Conséquence assumée : le jour où l'API partirait dans un conteneur, cette
adresse devrait redevenir configurable. Ce jour n'est pas prévu.

### 3. Le mot de passe de la base est dans le dépôt

`idea` / `idea` convient à un poste de développement, pas à une machine
publique. Le `docker-compose.yml` lira `${POSTGRES_PASSWORD:-idea}` : la valeur
par défaut garde le confort en local, la production reçoit un secret engendré et
rangé dans `server/.env`.

## Ce que l'hébergement **ne** change **pas**

Le travail des briques précédentes paie ici, et c'est la partie la plus courte
de cette conception :

- **L'URL de redirection Google.** Elle vaut `https://<ID>.chromiumapp.org/` et
  dépend de l'**extension**, pas du serveur. La configuration Google Cloud reste
  intacte.
- **Aucune ligne de `src/`.** `VITE_API_URL` est déjà résolu au build, et
  `host_permissions` en est **dérivé** dans `src/manifest.ts` — il ne peut pas
  diverger de l'adresse appelée. Passer en production est un `pnpm build`.
- **Le contrat.** `docs/openapi.yaml` ne bouge pas.

## L'architecture sur la machine

```
        Internet
           │ 443
           ▼
      ┌─────────┐
      │  Caddy  │  certificat Let's Encrypt, renouvelé seul
      └────┬────┘
           │ 127.0.0.1:3000
           ▼
   ┌───────────────┐
   │ idea-pipeline │  node dist/index.js, sous systemd
   └───────┬───────┘
           │ 127.0.0.1:5432
           ▼
   ┌───────────────┐
   │  postgres:17  │  conteneur, volume nommé
   └───────────────┘
```

Rien n'écoute publiquement à part Caddy. Le pare-feu `ufw` n'ouvre que **22, 80
et 443** — le 80 uniquement parce que Let's Encrypt en a besoin pour valider, et
Caddy y redirige tout vers 443.

## L'ordre du déploiement

Il compte, et pour une raison déjà connue : `db:types` interroge une **base
vivante**. La lancer contre une base non migrée ne lève aucune erreur — elle
produit une interface `DB` vide, et le build échoue après coup, loin de sa cause.

```
git pull
pnpm install && pnpm --dir server install
docker compose up -d --wait          # la base
pnpm --dir server db:migrate         # le schéma
pnpm --dir server db:types           # les types, depuis la base migrée
pnpm --dir server build              # dist/
sudo systemctl restart idea-pipeline
```

Le serveur a besoin des **dépendances de développement** : `tsx` porte
`db:migrate`, `kysely-codegen` porte `db:types`, `tsc` porte `build`. On
n'installe donc pas en `--prod`.

Le dépôt est cloné **en entier** : `prepare` régénère les types depuis
`../docs/openapi.yaml`, qui vit hors de `server/`.

## Les données existantes

Les 28 idées reprises de `chrome.storage.local` sont dans la base **locale**. Un
déploiement sur une base neuve repartirait de zéro — autant dire que la reprise
n'aurait servi à rien.

```
pg_dump local  →  scp  →  psql sur le VPS
```

Le compte et les sessions suivent : le `google_sub` est conservé, donc la
connexion Google retrouve le même utilisateur, et les idées restent les siennes.

## Les sauvegardes

Deux niveaux, parce qu'ils ne réparent pas la même panne.

|                         | Ce qu'elle sauve   | Ce qu'elle coûte à restaurer              |
| ----------------------- | ------------------ | ----------------------------------------- |
| **OVH, automatique**    | la machine entière | remonter une VM pour en extraire une base |
| **`pg_dump` quotidien** | la base seule      | une commande                              |

La première existe déjà et tourne. La seconde est un `cron` qui écrit un dump
compressé et garde les quatorze derniers. Un **snapshot** est pris avant la
première installation : point de retour instantané si le durcissement se passe
mal.

## Les secrets sur la machine

`server/.env` est écrit à la main, `chmod 600`, propriété de l'utilisateur de
déploiement. Il contient :

| Clé                    | Change en production ?                |
| ---------------------- | ------------------------------------- |
| `PORT`                 | non — 3000, derrière Caddy            |
| `DATABASE_URL`         | **oui** — nouveau mot de passe        |
| `POSTGRES_PASSWORD`    | **oui** — engendré, jamais réutilisé  |
| `GOOGLE_CLIENT_ID`     | non                                   |
| `GOOGLE_CLIENT_SECRET` | non                                   |
| `GOOGLE_REDIRECT_URI`  | **non** — il pointe `chromiumapp.org` |

`systemd` le lit par `EnvironmentFile=`, ce qui évite de dupliquer les valeurs
dans l'unité.

## Le durcissement

Le minimum qui compte sur une machine joignable depuis Internet :

- un **utilisateur non-root** pour le déploiement et le service ;
- **SSH par clé seulement** — `PasswordAuthentication no` ;
- **`ufw`** : 22, 80, 443, rien d'autre ;
- les mises à jour de sécurité **automatiques** (`unattended-upgrades`).

`fail2ban` est utile mais n'est pas dans cette brique : sans authentification par
mot de passe, il n'a plus grand-chose à bloquer.

## Tests

Rien d'automatisable ici : c'est de l'infrastructure, vérifiée par ses effets.

| Quoi                                     | Comment                                                          |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Le certificat est valide et de confiance | `curl https://api.hevinote.duckdns.org/ideas` → `401`, sans `-k` |
| La base n'est pas joignable              | depuis le poste, `5432` fermé sur l'IP publique                  |
| L'API n'est pas joignable en clair       | depuis le poste, `3000` fermé sur l'IP publique                  |
| Le service survit au redémarrage         | `sudo reboot`, puis le même `curl`                               |
| Le dump est restaurable                  | le rejouer dans une base jetable et compter                      |
| L'extension parle à la production        | se connecter, voir les 28 idées                                  |

Le quatrième est le seul qui juge vraiment l'installation : un service qui ne
revient pas seul après une coupure n'est pas déployé, il est démarré à la main.

## Dépendances

**Aucune dans le dépôt.** Sur la machine : Node 24, pnpm, Docker, Caddy — posés
par le PO, comme le client OAuth.

## Hors périmètre

- **Le déploiement automatique** (CI, webhook, image). `git pull` manuel d'abord.
- **La haute disponibilité**, le multi-instance, le load balancer.
- **La supervision** (métriques, alertes). `journalctl` suffit à un utilisateur.
- **Un site public sur la racine** du domaine — seul `api.` est servi.
- **L'application mobile**, qui pointera la même adresse le moment venu.
- **Le `staging`.** Une seule machine, un seul environnement.

## Notes / Blocage

- **Le nom est un DuckDNS, pas un domaine acheté.** Décision du PO : ne rien
  dépenser tant que le produit n'est pas éprouvé. Conséquence assumée — on dépend
  d'un service tiers gratuit pour la résolution ; s'il tombe, l'extension ne
  joint plus l'API. Une IP nue était l'autre voie et elle est pire : Caddy ne
  sait pas obtenir de certificat public pour une IP, et un auto-signé serait
  refusé par `fetch`.
- **`db:types` en production est un compromis.** Un serveur n'a pas à
  introspecter sa base pour compiler. La sortie propre serait de construire
  `dist/` ailleurs et de n'envoyer que le résultat ; c'est le déploiement
  automatique, volontairement reporté.
- **L'IP est dans `src/manifest.ts`** par transitivité, via `VITE_API_URL`.
  Changer de machine imposera un rebuild de l'extension — le domaine est
  précisément ce qui rend ce changement indolore.
