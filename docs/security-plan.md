# Sécurité des notes — plan d'implémentation

Met en œuvre `docs/security-design.md` : le contenu des notes devient illisible
**dans la base**, sans toucher au schéma, au contrat OpenAPI ni au front.

Rappel de ce que cette brique **ne fait pas** : elle n'empêche pas
l'application de lire, donc elle ne t'empêche pas de lire. C'est la brique
suivante, non décidée, qui le ferait.

## Qui fait quoi

| Qui        | Quoi                                                                |
| ---------- | ------------------------------------------------------------------- |
| **PO**     | engendre la clé, la pose dans `server/.env`, la sauvegarde ailleurs |
| **PO**     | lance les commandes serveur et colle les sorties                    |
| **PO**     | Git : commits, branches, pousse                                     |
| **Claude** | le code, les tests, la documentation, le texte des commits          |

**Aucune dépendance à installer.** `node:crypto` est dans Node. Le seul secret
de ce plan est engendré par le PO et n'apparaît ni dans le dépôt ni dans la
conversation — même cadre que le mot de passe de la base.

## Le fait qui dicte l'ordre

La tâche 8 du plan d'hébergement installe un `pg_dump` quotidien conservé
**14 jours**.

> Faite après cette brique, elle produit quatorze fichiers inoffensifs.
> Faite avant, elle produit **quatorze copies du clair**.

Cette brique passe donc devant. Elle ne dépend de rien d'autre.

---

## Lot 1 — La fondation

Rien ne change de comportement dans ce lot : on pose la clé et les deux
fonctions, et on les prouve isolément.

### Tâche 1 : la clé

**Pourquoi.** `env.ts` lit déjà `DATABASE_URL` et les secrets Google **à chaque
appel** et non à l'import — son commentaire explique que sous vitest le
conteneur ne publie son port qu'après le `global-setup`. La clé suit la même
règle, pour la même raison.

- [ ] Dans `server/src/config/env.ts`, ajouter :

```ts
export function noteKey(): Buffer {
  const raw = process.env.NOTE_KEY_V1;
  if (!raw) throw new Error('NOTE_KEY_V1 is required');

  const key = Buffer.from(raw, 'base64');
  // 32 octets, pas moins : une clé courte ne lève aucune erreur à l'usage,
  // elle affaiblit simplement tout, en silence.
  if (key.length !== 32) {
    throw new Error('NOTE_KEY_V1 must decode to 32 bytes');
  }

  return key;
}
```

- [ ] Ajouter à `server/.env.example` :

```
# 32 octets en base64 — `openssl rand -base64 32`.
# Chiffre le contenu des notes. LA PERDRE, C'EST PERDRE TOUTES LES NOTES :
# elle se sauvegarde ailleurs, et JAMAIS dans la meme sauvegarde que la base.
NOTE_KEY_V1=
```

- [ ] **PO** : engendrer la clé locale de développement et la poser dans
      `server/.env`.

```bash
openssl rand -base64 32
```

> Celle-ci est une clé de **développement**. La production en aura une autre,
> engendrée séparément (tâche 7). Ne jamais réutiliser l'une pour l'autre.

- [ ] Rendre la clé disponible aux tests. Le harnais fixe déjà `DATABASE_URL` à partir du conteneur ; ajouter dans `server/test/setup.ts` une clé fixe de
      test, avec un commentaire disant qu'elle n'a rien de secret.

**Vérification**

- [ ] `pnpm --dir server typecheck` vert.
- [ ] Sans la variable, un appel à `noteKey()` lève un message explicite.
- [ ] Une valeur de 31 octets lève aussi.

---

### Tâche 2 : `seal` et `open`

**Pourquoi.** Deux fonctions pures, testables sans base ni HTTP. C'est le seul
endroit du dépôt qui manipule de la cryptographie.

- [ ] Créer `server/src/store/notes.ts` :

```ts
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { noteKey } from '#config/env';

const PREFIX = 'v1.';
const IV = 12;
const TAG = 16;

// L'identifiant de l'idee est melange a la signature : un chiffre recopie dans
// l'idee d'un autre compte ne s'ouvre plus. Sans ca, une ecriture directe en
// base deplacerait une note d'un utilisateur vers un autre.
export function seal(text: string, ideaId: string): string {
  const iv = randomBytes(IV);
  const cipher = createCipheriv('aes-256-gcm', noteKey(), iv);
  cipher.setAAD(Buffer.from(ideaId));

  const body = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  // getAuthTag() n'a de valeur qu'apres final().
  const packed = Buffer.concat([iv, cipher.getAuthTag(), body]);

  return PREFIX + packed.toString('base64');
}

export function open(stored: string, ideaId: string): string {
  if (!stored.startsWith(PREFIX)) {
    throw new Error('Unknown note encoding');
  }

  const packed = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    noteKey(),
    packed.subarray(0, IV),
  );
  decipher.setAAD(Buffer.from(ideaId));
  decipher.setAuthTag(packed.subarray(IV, IV + TAG));

  return Buffer.concat([
    decipher.update(packed.subarray(IV + TAG)),
    decipher.final(),
  ]).toString('utf8');
}

// Le prefixe porte la version : le jour ou NOTE_KEY_V2 arrive, les lignes v1
// restent lisibles au lieu d'exiger une reecriture totale le meme jour.
export const isSealed = (value: string): boolean =>
  value.startsWith(PREFIX);
```

- [ ] Écrire `server/src/store/notes.test.ts` :

| Cas                                              | Attendu                               |
| ------------------------------------------------ | ------------------------------------- |
| Aller-retour simple                              | `open(seal(t)) === t`                 |
| Accents, emojis, retours à la ligne, 10 000 car. | identique au départ                   |
| Deux `seal` du même texte                        | **résultats différents** (IV neuf)    |
| Un octet du corps modifié                        | `open` lève                           |
| Le tag modifié                                   | `open` lève                           |
| Ouvert avec un autre `ideaId`                    | `open` lève                           |
| Valeur sans préfixe `v1.`                        | lève « Unknown note encoding »        |
| `isSealed`                                       | vrai sur un `seal`, faux sur du clair |

**Vérification**

- [ ] `pnpm test` vert, les 8 cas passent.
- [ ] Le test « deux `seal` diffèrent » échoue si on fige l'IV — le vérifier une
      fois à la main, sinon il ne prouve rien.

---

## Lot 2 — La bascule

### Tâche 3 : brancher le store

**Pourquoi.** Quatre points de contact, tous dans `server/src/store/ideas.ts`.
Rien au-dessus ne bouge : le service valide toujours le **clair** avec Zod,
avant que le store ne chiffre.

- [ ] `toVariation` déchiffre. `variations.idea_id` est déjà sur la ligne, donc
      **aucune signature ne change** :

```ts
const toVariation = (row: VariationRow): Variation => ({
  id: row.id,
  text: open(row.text, row.idea_id),
  createdAt: row.created_at.toISOString(),
});
```

- [ ] Vérifier que `readVariations` sélectionne bien `idea_id` (un `selectAll()`
      suffit ; une liste de colonnes explicite devrait l'inclure).
- [ ] `createIdea` : l'idée est insérée d'abord, son `id` est donc connu quand
      la variation part → `text: seal(text, idea.id)`.
- [ ] `addVariation` : `text: seal(text, id)`.
- [ ] `editVariation` : `.set({ text: seal(text, id) })`.

**Vérification**

- [ ] `pnpm test` vert — **toute la suite existante**, sans modification. C'est
      le signal que la couche est vraiment étanche : si un test de service ou de
      route doit changer, c'est que le chiffrement a fui hors du store.
- [ ] `pnpm --dir server typecheck` et `pnpm lint` verts.

---

### Tâche 4 : le test qui prouve

**Pourquoi.** Les tests de la tâche 2 prouvent que la cryptographie fonctionne.
Celui-ci prouve qu'elle est **réellement branchée** — et il échouera le jour où
quelqu'un ajoutera un chemin d'écriture qui la contourne.

- [ ] Dans `server/src/store/ideas.test.ts` (ou un fichier voisin) :

```
1. créer une idée par le store, avec un texte reconnaissable
2. lire la ligne en SQL brut, sans passer par toVariation
3. attendre : la valeur commence par 'v1.'
4. attendre : la valeur NE CONTIENT PAS le texte soumis
5. relire par le store : le texte revient intact
```

- [ ] Même chose après `addVariation` et après `editVariation` — les trois
      chemins d'écriture, pas seulement le premier.

**Vérification**

- [ ] `pnpm test` vert.
- [ ] Retirer un `seal` au hasard fait échouer ce test. À vérifier une fois.

---

## Lot 3 — L'existant

### Tâche 5 : la reprise

**Pourquoi.** Les idées déjà en base sont en clair. Elles ne se chiffreront pas
toutes seules.

- [ ] Créer `server/src/store/seal-cli.ts`, sur le modèle de `migrate-cli.ts`,
      et le script `db:seal` dans `server/package.json`.
- [ ] La logique, **idempotente** :

```
pour chaque ligne de variations :
  isSealed(text) ?  →  passer
  sinon             →  UPDATE ... SET text = seal(text, idea_id)
```

- [ ] Traiter par lots et dans une transaction ; afficher un compte final
      (`n chiffrées, m déjà faites`).
- [ ] Test : deux passages consécutifs ⇒ le second ne chiffre rien, et les
      textes restent lisibles par le store.

**Vérification**

- [ ] Sur la base de développement : `pnpm --dir server db:seal`, puis un
      `SELECT text FROM variations LIMIT 5` ne montre que des `v1.…`.
- [ ] L'extension continue d'afficher les idées normalement.
- [ ] Relancer `db:seal` ⇒ `0 chiffrées`.

---

## Lot 4 — Documentation et production

### Tâche 6 : la documentation

- [ ] `README.md` : la variable, comment l'engendrer, et **en gras** que la
      perdre perd toutes les notes.
- [ ] `.claude/rules/storage.md` : une ligne disant que `variations.text` est
      chiffré par le store, que le service valide le clair **avant**, et que le
      `CHECK (btrim(text) <> '')` ne valide donc plus la saisie.
- [ ] `.claude/rules/structure.md` : placer `store/notes.ts` et `seal-cli.ts`.
- [ ] `docs/hosting-plan.md` : noter en tête de la tâche 8 que les sauvegardes
      supposent cette brique faite.

---

### Tâche 7 : la production — **PO**

> À faire **avant** la tâche 8 de l'hébergement (les sauvegardes).

Trois règles commandent l'ordre des étapes. Les enfreindre est ce qui rend
l'opération dangereuse, pas la cryptographie elle-même.

| Règle                                               | Pourquoi                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Le service est arrêté** pendant toute l'opération | sinon l'ancien code rend du base64 à l'écran, ou le nouveau lève sur du clair                               |
| **Le clair ne touche jamais le disque du VPS**      | la sauvegarde OVH de la machine tourne déjà et peut capturer le fichier ; un `rm` n'atteint pas un snapshot |
| **Le dump se détruit en dernier**                   | un `SELECT` montrant des `v1.` ne prouve pas que l'application sait les relire                              |

#### A. Avant de toucher à la machine

- [ ] Engendrer une clé **distincte** de celle de développement :

```bash
openssl rand -base64 32
```

- [ ] La ranger dans le gestionnaire de mots de passe, puis **le fermer, le
      rouvrir et relire la clé**. Une clé mal enregistrée ne se découvre qu'au
      moment où elle manque, c'est-à-dire trop tard.
- [ ] **Jamais dans la même sauvegarde que la base :** une fuite qui emporterait
      les deux annulerait tout le bénéfice.

#### B. Arrêter, puis sauvegarder sans rien écrire en clair sur le VPS

```bash
sudo systemctl stop idea-pipeline
```

- [ ] Le dump transite par le tunnel SSH et atterrit **chez toi** :

```bash
ssh <vps> 'cd /srv/idea-pipeline && docker compose exec -T db \
  pg_dump -U idea --clean --if-exists idea_pipeline' > avant-chiffrement.sql
grep -c 'INSERT\|COPY' avant-chiffrement.sql
```

- [ ] Relever les compteurs d'avant, pour pouvoir les comparer :

```bash
cd /srv/idea-pipeline && docker compose exec -T db psql -U idea -d idea_pipeline -c "
SELECT (SELECT count(*) FROM ideas) AS idees,
       (SELECT count(*) FROM variations) AS variations;"
```

#### C. La clé, puis le déploiement

- [ ] Ajouter `NOTE_KEY_V1` à `server/.env` sur la machine, `chmod 600`
      inchangé.
- [ ] **Comparer ses premiers caractères avec l'entrée du gestionnaire.**
      Pas après : maintenant.

> La reprise n'a aucun moyen de refuser une clé. Lors de la toute première
> passe, aucune ligne ne porte le préfixe, donc le garde-fou à trois issues ne
> se déclenche jamais : **la clé présente dans `.env` à cet instant devient, par
> définition, la bonne**. Le danger n'est pas une clé « fausse », c'est la clé
> de **développement** collée ici — la base de production serait alors chiffrée
> avec un secret qui traîne aussi sur ton portable.

- [ ] Déployer :

```bash
git pull
pnpm install && pnpm --dir server install
pnpm --dir server db:migrate    # aucune nouvelle migration ici, la chaîne reste la même
pnpm --dir server db:types
pnpm --dir server build
```

> **L'extension n'a pas besoin d'être reconstruite ni republiée :** le front n'a
> pas changé d'une ligne dans cette brique.

- [ ] _(facultatif — ici, pendant que le service est déjà arrêté, jamais à la
      fin)_ vérifier le refus au démarrage :

```bash
cd server && env -u NOTE_KEY_V1 node dist/index.js   # Error: NOTE_KEY_V1 is required
```

#### D. La reprise

```bash
pnpm --dir server db:seal
```

- [ ] Attendu : `Sealed: N. Already sealed: 0.` — avec `N` égal au nombre de
      variations relevé en B.
- [ ] La base ne montre plus que du chiffré :

```bash
cd /srv/idea-pipeline && docker compose exec -T db psql -U idea -d idea_pipeline -c \
  "SELECT text FROM variations LIMIT 10;"
```

- [ ] Les compteurs n'ont pas bougé :

```bash
cd /srv/idea-pipeline && docker compose exec -T db psql -U idea -d idea_pipeline -c "
SELECT (SELECT count(*) FROM ideas) AS idees,
       (SELECT count(*) FROM variations) AS variations;"
```

> Le nombre de **caractères**, lui, a augmenté : le base64 et l'en-tête pèsent
> plus que le texte. C'est attendu, ce n'est pas un signe de duplication.

#### E. La vérification qui compte

```bash
sudo systemctl start idea-pipeline
sudo systemctl status idea-pipeline --no-pager
```

Dans le panneau, les trois gestes — aucun ne peut être sauté, ils couvrent les
trois chemins d'écriture et la lecture :

- [ ] **Ouvrir une idée d'avant la reprise** → prouve le déchiffrement.
- [ ] **Capturer une idée** → prouve `createIdea`.
- [ ] **Reformuler**, puis **corriger** une idée → prouvent `addVariation` et
      `editVariation`.
- [ ] Relancer la reprise : `pnpm --dir server db:seal` ⇒ `Sealed: 0.`

#### F. Seulement maintenant

- [ ] Détruire ta copie locale de `avant-chiffrement.sql`. C'est la dernière
      copie en clair, et la seule dont l'existence était justifiée.

#### Si l'étape E tourne mal

Possible **tant que le dump existe** — c'est toute la raison pour laquelle F
vient après E.

```bash
sudo systemctl stop idea-pipeline
ssh <vps> 'cd /srv/idea-pipeline && docker compose exec -T db \
  psql -U idea -d idea_pipeline' < avant-chiffrement.sql
git checkout <le commit d'avant la brique>
pnpm --dir server build && sudo systemctl start idea-pipeline
```

La base revient en clair, le code revient à celui qui sait la lire. On
recommence en A.

---

## Ce que ce plan ne fait pas

- **Il ne t'empêche pas de lire.** L'application déchiffre ; avec un accès à la
  machine, le contenu reste atteignable. C'est la couche cliente qui lèverait
  ça, et elle n'est pas décidée.
- Il ne chiffre **pas** `status`, les dates, ni l'e-mail — voir la conception.
- Il ne masque pas la **taille** des notes.
- Il ne touche ni au front, ni au contrat OpenAPI, ni au schéma.

## Notes / Blocage

- `server/test/setup.ts` recevra une clé de test en clair. C'est volontaire et
  ça doit être commenté : un secret de test n'est pas un secret.
- **Le garde-fou de la reprise ne protège pas la première passe.** Il refuse de
  continuer sur une ligne préfixée `v1.` qui ne s'ouvre pas — mais lors de la
  toute première reprise aucune ligne ne porte le préfixe, donc il ne se
  déclenche jamais. La clé présente dans `.env` à cet instant devient la bonne,
  quelle qu'elle soit. La seule parade est humaine, et elle est dans la tâche 7 :
  comparer la clé avec le gestionnaire **avant** de lancer `db:seal`.
- La rotation (`NOTE_KEY_V2`) est **prévue par le format** mais n'est pas
  implémentée ici. Le jour où elle servira, `open` devra choisir la clé d'après
  le préfixe. Hors périmètre de cette brique.
- Le `CHECK (btrim(text) <> '')` survit mais change de sens. Le retirer serait
  une migration : **décision PO**, je n'y touche pas.
- Dès que `status` deviendra configurable, il passera du côté du contenu et
  demandera le même traitement. À garder en tête pour cette brique-là.

## Messages de commit proposés

Un par lot, pour que la bascule soit isolable si elle doit être annulée.

```
feat(server): add the note encryption key to the environment

Read on each call like the other secrets, since vitest only fills the
environment after the global setup. A key that does not decode to 32
bytes is refused at once: a short one weakens everything in silence.
```

```
feat(store): seal and open note content with AES-256-GCM

A fresh IV per write, so two identical notes do not look alike, and
the idea's id mixed into the signature, so a row copied into another
account's idea no longer opens.
```

```
feat(store): encrypt note content on the way to the database

The three write paths seal, the row mapper opens. Nothing above the
store changes: the service still validates the plaintext with Zod
before it gets here, and the whole existing suite passes untouched.

A test reads the row in raw SQL and asserts the submitted text is not
in it — that one fails the day a write path skips the sealing.
```

```
chore(server): re-encrypt the notes written before this brick

Idempotent: a row already prefixed v1. is skipped, so the script can
be run again without harm.
```
