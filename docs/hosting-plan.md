# Hébergement — plan d'implémentation

> **Pour l'exécutant :** les étapes sont des cases à cocher (`- [ ]`). Une étape
> = une action. On ne passe pas à la suivante sans avoir lancé la vérification de
> la précédente.

**But :** rendre l'API joignable en HTTPS depuis n'importe quel navigateur, avec
les données existantes, sur le VPS OVH.

**Architecture :** Caddy termine le TLS et relaie vers une API Node lancée par
`systemd`, qui parle à un PostgreSQL en conteneur. Rien n'écoute publiquement à
part Caddy.

**Pile :** aucune dépendance nouvelle dans le dépôt. Sur la machine : Node 24,
pnpm, Docker, Caddy.

**Spec :** `docs/hosting-design.md` (validée par le PO).

## Qui fait quoi

Je n'ai **aucun accès au VPS**, et je n'en demande pas. La répartition est donc
fixe pour tout ce plan :

|                    |                                                                               |
| ------------------ | ----------------------------------------------------------------------------- |
| **Moi**            | les correctifs du dépôt, les fichiers de configuration, les commandes exactes |
| **Toi**            | tout ce qui s'exécute sur la machine et dans la console OVH                   |
| **Moi, à nouveau** | la vérification **depuis l'extérieur** — DNS, ports, certificat, `curl`       |

Cette dernière colonne compte : à chaque palier je contrôle le résultat sans te
croire sur parole, avec les mêmes outils qu'un attaquant.

## Contraintes globales

- **Git : 100 % manuel.** Les étapes « Commit » donnent le **texte** ; tu commites.
- **Installation : 100 % manuelle.** La brique n'ajoute aucune dépendance au
  dépôt. Ce qui s'installe sur la machine, c'est toi qui le lances.
- **Le contrat ne bouge pas.**
- **Code en anglais**, commentaires compris.
- **Le livré passe `pnpm lint`, `pnpm typecheck` et `pnpm test`.**
- Terrain : VPS-2 2027 · Ubuntu · `152.228.136.127` · SBG.
- **Le mot de passe de la base n'apparaît jamais dans le dépôt ni dans cette
  conversation.** Il est engendré sur la machine et y reste.

## Deux faits qui dictent l'ordre

1. **La tâche 2 ne bloque que les tâches 5 à 8**, et elle est **faite** : le nom
   `api.hevinote.duckdns.org` pointe déjà le VPS. Le nom n'est nécessaire qu'au
   certificat ; tout le reste s'installe sans lui.
2. **`db:types` interroge une base vivante.** L'ordre `compose up` →
   `db:migrate` → `db:types` → `build` n'est pas une préférence : régénérer
   contre une base non migrée produit une interface `DB` **vide**, sans erreur,
   et le build casse loin de sa cause.

---

## Tâche 1 : les quatre correctifs du dépôt

Sans réseau, sans VPS. C'est du code, vérifiable ici.

**Fichiers :** modifier `docker-compose.yml`, `server/src/index.ts`,
`server/package.json`, `.env.example`

- [ ] **Étape 1 : fermer la base sur l'extérieur, et sortir son mot de passe du dépôt**

Dans `docker-compose.yml` :

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: idea
      # Lu depuis le .env de la racine, que Compose charge tout seul. La valeur
      # par defaut garde le confort en developpement ; la production en fournit
      # une engendree.
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-idea}
      POSTGRES_DB: idea_pipeline
    ports:
      # 127.0.0.1 et pas 0.0.0.0 : sur un VPS, la seconde forme publierait
      # PostgreSQL sur Internet. Seule l'API, sur la meme machine, l'atteint.
      - '127.0.0.1:5432:5432'
```

Le reste du fichier ne change pas.

**Piège** : Compose lit le `.env` **de son propre dossier** — la racine du
dépôt — pas `server/.env`. Le mot de passe apparaîtra donc à deux endroits sur la
machine : la racine pour le conteneur, `server/.env` pour l'API. L'étape 2 de la
tâche 4 les écrit **dans la même commande**, ce qui rend la divergence improbable ; et le
premier `db:migrate` échouerait immédiatement si elle survenait.

- [ ] **Étape 2 : l'API n'écoute plus que sur la boucle locale**

Dans `server/src/index.ts` :

```typescript
import { app } from '#app';
import { env } from '#config/env';

// Caddy relaie depuis la meme machine. Ecouter sur 0.0.0.0 exposerait l'API en
// clair a cote du HTTPS cense la couvrir.
app.listen(env.port, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${env.port}`);
});
```

Rien ne change en développement : le panneau appelle `localhost`, sur la même
machine.

- [ ] **Étape 3 : un script pour la production**

Dans `server/package.json`, à côté de `dev` :

```json
"start": "node --env-file=.env dist/index.js",
```

`--env-file` plutôt qu'un `EnvironmentFile=` dans l'unité `systemd` : le
développement et la production chargent alors leur environnement **par le même
mécanisme**, et l'unité n'a pas à dupliquer un chemin.

- [ ] **Étape 4 : documenter la variable nouvelle**

Dans `.env.example`, à la racine :

```
# Mot de passe PostgreSQL, lu par docker compose. Vide = 'idea', ce qui convient
# en local. En production : une valeur engendree, identique a celle du
# DATABASE_URL de server/.env.
POSTGRES_PASSWORD=
```

- [ ] **Étape 5 : vérifier que rien n'est cassé**

```bash
pnpm typecheck && pnpm lint && pnpm test
docker compose down && docker compose up -d --wait
ss -lptn 'sport = :5432' | tail -2
```

Attendu : tout vert, et l'écoute sur **`127.0.0.1:5432`**, plus sur `*:5432`.

- [ ] **Étape 6 : prouver que la fermeture mord**

Depuis une **autre** machine du réseau local, ou simplement en visant l'adresse
non-locale de ton poste :

```bash
timeout 3 bash -c '</dev/tcp/<ip-locale-du-poste>/5432' && echo OUVERT || echo fermé
```

Attendu : **fermé**. Avant ce correctif, c'était ouvert.

- [ ] **Étape 7 : commit**

```
fix(server): stop exposing the database and the api to the network

docker compose published 5432 on every interface with the password in
the repo, and the API listened on 0.0.0.0. Both are harmless on a
laptop and wrong on a public host, which is where this is going.

Adds the start script the deployment needs.
```

---

## Tâche 2 : le nom d'hôte — **PO** — _faite_

**Bloquante pour les tâches 5 à 8 seulement.** Le nom ne sert qu'au certificat.

Le PO a écarté l'achat d'un domaine pour l'instant. Une IP nue ne convient pas :
Caddy ne sait obtenir de certificat public que pour un nom, et servirait sinon un
**auto-signé**, que `fetch` refuse — l'extension afficherait « Connexion
impossible » sans rien expliquer. Un sous-domaine DuckDNS lève l'obstacle sans
rien dépenser et sans changer une ligne du reste du plan.

- [x] **Étape 1 : créer le nom**

[duckdns.org](https://www.duckdns.org) → se connecter → choisir un sous-domaine →
renseigner `152.228.136.127` dans **current ip** → **update ip**.

Retenu : **`hevinote.duckdns.org`**, et l'API servie sur
**`api.hevinote.duckdns.org`**. DuckDNS répond pour les sous-domaines sans
déclaration supplémentaire — les deux pointent déjà la bonne adresse.

Le préfixe `api.` ne sert à rien techniquement ici ; il est gardé pour que le
passage à un vrai domaine ne change que le suffixe.

- [x] **Étape 2 : vérifier la propagation**

```bash
getent ahostsv4 api.hevinote.duckdns.org
```

Obtenu : `152.228.136.127`. ✔

**Pourquoi DuckDNS marche là où `vps.ovh.net` échouait** : Let's Encrypt compte
ses limites par _domaine enregistré_, calculé avec la Public Suffix List.
`duckdns.org` y figure, donc `hevinote.duckdns.org` est un domaine enregistré à
part entière — tu ne partages la limite avec personne. `ovh.net` n'y figure pas :
tous les VPS du monde s'y partagent 20 certificats par semaine.

**Ce n'est pas définitif.** Le jour où un vrai domaine est acheté, il faut un
enregistrement `A`, une ligne du `Caddyfile`, un `VITE_API_URL` et un
`pnpm build`. Rien d'autre ne bouge.

---

## Tâche 3 : la machine — filet, durcissement, outils

**Tout s'exécute sur le VPS.** Connexion : `ssh ubuntu@152.228.136.127` (ou
`root`, selon ce qu'OVH a installé).

- [ ] **Étape 1 : le filet, avant tout le reste**

Console OVH → ton VPS → carte **Backup** → **Snapshot** → **Créer**.

C'est un point de retour instantané. Si le durcissement coupe ton propre accès
SSH — le classique — c'est ce qui te sauve.

- [ ] **Étape 2 : un utilisateur non-root**

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG sudo deploy
sudo rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
```

- [ ] **Étape 3 : vérifier l'accès AVANT de fermer quoi que ce soit**

**Depuis ton poste, dans un second terminal** — garde le premier ouvert :

```bash
ssh deploy@152.228.136.127 'id && sudo -n true && echo "sudo ok"'
```

Attendu : l'identité de `deploy`, puis `sudo ok`. **Si ça échoue, arrête-toi** —
l'étape suivante te fermerait la porte.

- [ ] **Étape 4 : SSH par clé seulement**

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sshd -t && sudo systemctl reload ssh
```

`sshd -t` valide la configuration **avant** le rechargement : une faute de
frappe ne coupera pas le service.

- [ ] **Étape 5 : le pare-feu**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```

Le `80` n'est là que pour la validation Let's Encrypt ; Caddy y redirigera tout
vers le `443`.

- [ ] **Étape 6 : les mises à jour de sécurité automatiques**

```bash
sudo apt update && sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

- [ ] **Étape 7 : Node 24, pnpm, Docker, Caddy**

Node vient de **NodeSource**, pas de `nvm` : `nvm` installe par utilisateur, et
`systemd` ne retrouverait pas le binaire.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git
sudo corepack enable && corepack prepare pnpm@latest --activate

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy      # se reconnecter ensuite

sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

- [ ] **Étape 8 : vérifier**

```bash
node --version && pnpm --version && docker --version && caddy version
```

Attendu : Node **24.x**, et les trois autres présents.

- [ ] **Étape 9 : je contrôle depuis l'extérieur**

Dis-le-moi, je sonde les ports. Attendu : **22 ouvert**, **80 ouvert** (Caddy
sert sa page par défaut), **443 ouvert**, **3000 et 5432 fermés**.

---

## Tâche 4 : l'API en production

**Sur le VPS, en tant que `deploy`.** Le domaine n'est pas encore nécessaire.

- [ ] **Étape 1 : le dépôt**

Le dépôt est cloné **en entier** : `prepare` régénère les types depuis
`../docs/openapi.yaml`, qui vit hors de `server/`.

```bash
sudo mkdir -p /srv && sudo chown deploy:deploy /srv
git clone <url-du-depot> /srv/idea-pipeline
cd /srv/idea-pipeline
```

- [ ] **Étape 2 : les secrets, engendrés sur place**

Un seul bloc, pour que les deux fichiers reçoivent **le même** mot de passe :

```bash
cd /srv/idea-pipeline
PGPASS="$(openssl rand -base64 30 | tr -d '/+=' | head -c 32)"

printf 'POSTGRES_PASSWORD=%s\n' "$PGPASS" > .env

cat > server/.env <<EOF
PORT=3000
DATABASE_URL=postgres://idea:${PGPASS}@127.0.0.1:5432/idea_pipeline
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://anlcenbklgoiehedbffhcbnbjlfdemcl.chromiumapp.org/
EOF

chmod 600 .env server/.env
unset PGPASS
```

Puis **compléter à la main** `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` avec
les valeurs de ton `server/.env` local. `GOOGLE_REDIRECT_URI` est déjà juste :
il pointe l'**extension**, pas le serveur, donc il ne change pas.

- [ ] **Étape 3 : installer, migrer, générer, construire**

L'ordre n'est pas négociable — voir « Deux faits » en tête de plan.

```bash
cd /srv/idea-pipeline
pnpm install && pnpm --dir server install
docker compose up -d --wait
pnpm --dir server db:migrate
pnpm --dir server db:types
pnpm --dir server build
```

Les **dépendances de développement** sont nécessaires : `tsx` porte
`db:migrate`, `kysely-codegen` porte `db:types`, `tsc` porte `build`. Donc pas
de `--prod`.

- [ ] **Étape 4 : le service**

```bash
sudo tee /etc/systemd/system/idea-pipeline.service > /dev/null <<'EOF'
[Unit]
Description=idea-pipeline API
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/srv/idea-pipeline/server
ExecStart=/usr/bin/node --env-file=.env dist/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now idea-pipeline
sudo systemctl status idea-pipeline --no-pager
```

- [ ] **Étape 5 : vérifier sur place**

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/ideas
```

Attendu : **`401`**. C'est la bonne réponse — l'API tourne et refuse une requête
sans session. Un `000` signifie qu'elle n'écoute pas ; `journalctl -u
idea-pipeline -n 50` dira pourquoi.

- [ ] **Étape 6 : le test qui juge l'installation**

```bash
sudo reboot
```

Attendre une minute, se reconnecter, relancer le `curl` de l'étape 5.

Attendu : **`401` à nouveau, sans rien avoir relancé.** Un service qui ne revient
pas seul n'est pas déployé, il est démarré à la main. Le conteneur PostgreSQL
revient par sa politique de redémarrage Compose, l'API par `systemd`.

- [ ] **Étape 7 : je contrôle depuis l'extérieur**

Attendu : **`3000` et `5432` toujours fermés** vus d'Internet. L'API tourne, et
personne hors de la machine ne peut la joindre — c'est exactement l'état voulu
avant Caddy.

---

## Tâche 5 : le HTTPS

**Dépend de la tâche 2.** Sans le `A`, Let's Encrypt refusera.

- [ ] **Étape 1 : le site**

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
api.hevinote.duckdns.org {
	reverse_proxy 127.0.0.1:3000
}
EOF

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

`caddy validate` contrôle la syntaxe avant le rechargement.

C'est tout : Caddy demande le certificat au premier appel, et le renouvelle seul.
Ni cron, ni certbot.

- [ ] **Étape 2 : suivre l'obtention**

```bash
sudo journalctl -u caddy -f
```

Attendu : une ligne `certificate obtained successfully`. Une erreur mentionnant
le DNS signifie que le `A` n'est pas encore propagé — attendre, pas insister
(Let's Encrypt limite les tentatives).

- [ ] **Étape 3 : je contrôle depuis l'extérieur**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.hevinote.duckdns.org/ideas
```

Attendu : **`401`**, **sans `-k`**. Le `-k` désactive la vérification du
certificat : s'il fallait l'ajouter, le certificat ne serait pas de confiance et
l'extension refuserait de parler au serveur. Je vérifierai aussi l'émetteur et la
date d'expiration.

---

## Tâche 6 : la reprise des données

Les 28 idées sont dans la base **locale**. Sans cette tâche, la production part
vide.

- [ ] **Étape 1 : le dump, depuis le poste**

```bash
docker compose exec -T db pg_dump -U idea --clean --if-exists idea_pipeline \
  > /tmp/idea-pipeline.sql
grep -c 'INSERT\|COPY' /tmp/idea-pipeline.sql
```

- [ ] **Étape 2 : le transfert**

```bash
scp /tmp/idea-pipeline.sql deploy@152.228.136.127:/tmp/
```

- [ ] **Étape 3 : la restauration, sur le VPS**

```bash
cd /srv/idea-pipeline
docker compose exec -T db psql -U idea -d idea_pipeline < /tmp/idea-pipeline.sql
rm /tmp/idea-pipeline.sql
```

`--clean --if-exists` remplace le schéma créé par `db:migrate`. C'est voulu : le
dump porte le schéma **et** les données, y compris `schema_migrations`.

- [ ] **Étape 4 : compter**

```bash
docker compose exec -T db psql -U idea -d idea_pipeline -c "
SELECT (SELECT count(*) FROM users) AS comptes,
       (SELECT count(*) FROM ideas) AS idees,
       (SELECT count(*) FROM variations) AS variations,
       (SELECT sum(length(text)) FROM variations) AS caracteres;"
```

Attendu, **exactement** : `1 | 28 | 33 | 6747`. Le compte de caractères est le
contrôle qui vaut : il prouve que le texte a traversé sans perdre un octet.

- [ ] **Étape 5 : effacer le dump du poste**

```bash
rm -f /tmp/idea-pipeline.sql
```

---

## Tâche 7 : la bascule de l'extension

- [ ] **Étape 1 : pointer la production**

Dans le `.env` de la racine, **sur le poste** :

```
VITE_API_URL=https://api.hevinote.duckdns.org
```

- [ ] **Étape 2 : construire et contrôler le manifest**

```bash
pnpm build
python3 -c "
import json; m = json.load(open('dist/manifest.json'))
print('host_permissions :', m['host_permissions'])"
```

Attendu : `['https://api.hevinote.duckdns.org/*']`. Cette ligne n'a pas été écrite à la
main — elle est **dérivée** de `VITE_API_URL` dans `src/manifest.ts`, et c'est ce
qui empêche l'autorisation de diverger de l'adresse appelée.

- [ ] **Étape 3 : recharger et se connecter**

`chrome://extensions` → ↻ → ouvrir le panneau → **Se connecter avec Google**.

Attendu : la fenêtre Google s'ouvre, et **les 28 idées apparaissent**.

- [ ] **Étape 4 : la preuve que c'est bien la production**

Couper le serveur **local** s'il tourne encore, puis recharger le panneau. Les
idées doivent rester. Si elles disparaissent, l'extension parlait encore à
`localhost`.

- [ ] **Étape 5 : le second navigateur**

C'est la promesse du produit, jamais vérifiée jusqu'ici. Ouvrir l'extension dans
un **autre profil Chrome**, se connecter avec le même compte Google.

Attendu : **les mêmes 28 idées**. En créer une dans l'un, recharger l'autre,
elle est là.

- [ ] **Étape 6 : commit**

```
feat: point the extension at the hosted api
```

---

## Tâche 8 : les sauvegardes et la documentation

> **Suppose `docs/security-plan.md` fait.** Le dump quotidien est conservé
> quatorze jours : avant le chiffrement des notes, il fabrique quatorze copies
> du texte en clair. Cette tâche passe après.

- [ ] **Étape 1 : le dump quotidien**

Sur le VPS :

```bash
sudo mkdir -p /var/backups/idea-pipeline
sudo chown ubuntu:ubuntu /var/backups/idea-pipeline

cat > /srv/idea-pipeline/backup.sh <<'EOF'
#!/bin/sh
set -eu
cd /srv/idea-pipeline
docker compose exec -T db pg_dump -U idea idea_pipeline \
  | gzip > "/var/backups/idea-pipeline/$(date +%F).sql.gz"
# Quatorze jours : assez pour remarquer une corruption, assez peu pour tenir
# sur le disque sans surveillance.
find /var/backups/idea-pipeline -name '*.sql.gz' -mtime +14 -delete
EOF
chmod +x /srv/idea-pipeline/backup.sh

( crontab -l 2>/dev/null; echo '0 3 * * * /srv/idea-pipeline/backup.sh' ) | crontab -
```

`backup.sh` n'est **pas versionné** : il porte des chemins propres à cette
machine.

- [ ] **Étape 2 : prouver que le dump est restaurable**

Un dump jamais rejoué n'est pas une sauvegarde, c'est un fichier.

```bash
/srv/idea-pipeline/backup.sh
cd /srv/idea-pipeline
docker compose exec -T db createdb -U idea restore_test
gunzip -c "/var/backups/idea-pipeline/$(date +%F).sql.gz" \
  | docker compose exec -T db psql -U idea -d restore_test
docker compose exec -T db psql -U idea -d restore_test -c 'SELECT count(*) FROM ideas;'
docker compose exec -T db dropdb -U idea restore_test
```

Attendu : **28**.

- [ ] **Étape 3 : la documentation**

- `README.md` : une section **Production** — l'adresse, la séquence de
  déploiement, `journalctl -u idea-pipeline`, le rôle de `backup.sh`.
- `CLAUDE.md` : l'hébergement n'est plus « conçu, pas encore livré ». **Plus
  rien ne reste dans cette catégorie** — la phrase disparaît.
- `.claude/rules/structure.md` : `server/.env` et le `.env` de la racine portent
  désormais des secrets de production.

- [ ] **Étape 4 : commit**

```
docs: record the hosted deployment

CLAUDE.md kept a "decided but not built" section for the hosting. It is
built, and nothing else is in that state, so the section goes.
```

---

## Ce que ce plan ne fait pas

- **Le déploiement automatique** — `git pull` manuel, comme décidé.
- **La haute disponibilité**, la supervision, le `staging`.
- **Un site public** sur la racine du domaine.
- **`fail2ban`** — sans authentification par mot de passe, il lui reste peu à
  bloquer.
- **L'application mobile.**

## Notes / Blocage

- **Le mot de passe de la base vit à deux endroits** sur la machine : le `.env`
  de la racine pour le conteneur, `server/.env` pour l'API. Compose ne lit pas le
  second. L'étape 2 de la tâche 4 les écrit ensemble ; une divergence ferait
  échouer `db:migrate` immédiatement, ce qui est le bon moment pour l'apprendre.
- **`db:types` sur le serveur** reste un compromis, consigné dans la spec.
- **`backup.sh` n'est pas versionné.** Si la machine est perdue, il se réécrit
  depuis ce plan.
