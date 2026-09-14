# Connexion Google — conception

> L'extension · `launchWebAuthFlow` + PKCE · identité et déconnexion réelles

## Pourquoi

Le serveur sait déjà se connecter à Google. `POST /auth/google` échange le code
avec le `client_secret`, lit `sub` et `email`, crée ou retrouve le compte, ouvre
une session. `GET /auth/me` et `DELETE /auth/session` existent aussi.

**L'extension n'appelle aucun des trois.** Elle colle un jeton fabriqué à la
main — une béquille posée par la brique précédente, qui porte son propre
commentaire : « la brique Google remplace ce formulaire, et seulement lui ».

Un second défaut se règle ici. Aujourd'hui « se déconnecter » efface le jeton du
`chrome.storage.session` et **laisse la ligne vivre en base**. La session reste
valable 30 jours. Ce n'est pas une déconnexion, c'est un oubli — et sur un
produit dont l'argument est « plusieurs navigateurs à la fois », c'est le
mauvais défaut à garder.

## Décisions actées

| Sujet             | Décision                                                                          |
| ----------------- | --------------------------------------------------------------------------------- |
| ID de l'extension | **`key` fixée dans le manifest** — le même ID sur toute machine                   |
| Flux              | **`launchWebAuthFlow` + PKCE S256**, porté par le **service worker**              |
| Collage du jeton  | **supprimé**, sans repli                                                          |
| Identité          | **avatar turquoise à initiale** dans la barre de titre, menu au clic              |
| Déconnexion       | **un seul temps**, révoque côté serveur, **part quand même** s'il est injoignable |
| Portée            | les **trois** endpoints existants sont branchés ; **aucun nouveau**               |
| Contrat           | **inchangé** — `docs/openapi.yaml` décrit déjà tout ce que la brique consomme     |

Maquette validée : `design/mockup-profile.html` (emplacement A, avatar
turquoise). L'écran de connexion lui-même l'était déjà dans
`design/mockup-auth.html`.

## Trois faits vérifiés

Ils décident la forme, donc ils ne sont pas pris de mémoire.

1. **`launchWebAuthFlow` échappe au minuteur du service worker.** C'est l'une
   des rares API extension explicitement exemptées du délai, parce qu'elle
   affiche une invite à l'utilisateur et peut légitimement durer. Le worker peut
   donc porter le flux de bout en bout — ce qui tombe bien : l'architecture posée
   à la brique précédente veut que **lui seul parle au réseau et détienne le
   jeton**.
2. **Google accepte `https://<ID>.chromiumapp.org/`** comme URL de redirection
   pour un client de type _Web application_. C'est le motif prévu pour les
   extensions ; `chromiumapp.org` s'ajoute aux domaines autorisés de l'écran de
   consentement.
3. **L'échange reste serveur.** Il exige le `client_secret`, qui n'a rien à faire
   dans une extension. L'extension n'obtient qu'un **code d'autorisation**, sans
   valeur sans le secret ni le `code_verifier`.

## L'ID de l'extension

L'URL de redirection contient l'ID, et l'ID est déclaré chez Google. Or une
extension chargée « non empaquetée » tire son ID du **chemin absolu** du dossier :
déplacer le dépôt, ou le charger depuis une autre machine, change l'ID et casse
la connexion.

Une `key` dans le manifest fixe l'ID une fois pour toutes. Elle contient la
**clé publique** d'une paire RSA, en base64 ; Chrome dérive l'ID de son
empreinte SHA-256.

```
key.pem  (privée)  →  jamais versionnée, .gitignore
    │
    └── clé publique DER → base64 → src/manifest.ts  (key)
                              │
                              └── SHA-256, 16 premiers octets, a–p → ID
```

La clé publique **est** versionnée : elle n'est pas un secret, et c'est elle qui
garantit que tout le monde obtient le même ID. La privée ne sert qu'à signer un
`.crx` auto-hébergé ; elle reste hors du dépôt.

## Le flux, pas à pas

```
Panneau            Service worker                 Google                Serveur
   │
   │ session/signIn ─▶
   │                  ① verifier + challenge + state
   │                  ② launchWebAuthFlow ──────▶ écran de consentement
   │                  ◀──── redirection ?code=…&state=… ──┘
   │                  ③ vérifie state
   │                  ④ POST /auth/google ─────────────────────────────▶
   │                       { code, codeVerifier }        échange (secret) ─▶
   │                                                     ◀──── id_token ───
   │                  ◀──────────────── { token, user } ─────────────────┘
   │                  ⑤ writeToken(token)
   │ ◀── { user } ────┘
```

Le panneau ne voit **ni le code, ni le verifier, ni le jeton** — seulement
l'utilisateur qui en résulte. C'est la même frontière que pour les idées.

### Ce que le worker fabrique

| Élément          | Fabrication                                              |
| ---------------- | -------------------------------------------------------- |
| `code_verifier`  | 32 octets de `crypto.getRandomValues`, encodés base64url |
| `code_challenge` | `base64url(SHA-256(verifier))`, via `crypto.subtle`      |
| `state`          | 16 octets, base64url                                     |
| `redirect_uri`   | `chrome.identity.getRedirectURL()`                       |

Tout est natif dans un service worker MV3. **Aucune dépendance.**

### Pourquoi `state` alors que PKCE est là

PKCE empêche qu'un code volé soit échangé par un autre. Il n'empêche pas
qu'un code **étranger soit injecté dans notre flux** — l'attaque qui connecte la
victime au compte de l'attaquant. C'est `state` qui couvre ce cas.

Le risque est ici très faible : la réponse ne transite par aucun endpoint public,
elle revient directement de la fenêtre que le worker a ouverte. On le prend quand
même, parce qu'il coûte quatre lignes et que son absence demanderait une
justification plus longue que son implémentation.

### Ce que `client_id` fait dans l'extension

L'extension construit l'URL d'autorisation, donc elle a besoin du `client_id` —
qui n'est pas un secret. Il vit dans `VITE_GOOGLE_CLIENT_ID`, à côté du
`VITE_API_URL` existant.

**Trois valeurs doivent s'accorder** : l'URL de redirection déclarée chez Google,
`GOOGLE_REDIRECT_URI` du serveur, et l'ID que `getRedirectURL()` produit. Rien ne
le vérifie automatiquement ; une divergence se manifeste par un
`redirect_uri_mismatch` côté Google, que le serveur traduit en
`Code d'autorisation invalide.` — message trompeur pour une erreur de
configuration. Les trois `.env.example` se renvoient l'un à l'autre en
commentaire. Voir « Notes » pour ce qu'on ferait si ça mordait.

## Le contrat entre le panneau et le worker

`src/lib/protocol.ts` change sur la moitié `session/`. La moitié `ideas/` ne
bouge pas.

| Requête                 | Devient                       | Réponse         |
| ----------------------- | ----------------------------- | --------------- |
| `session/status`        | inchangée                     | `{ connected }` |
| `session/set` _(token)_ | **supprimée**                 | —               |
| `session/signIn`        | **nouvelle** — lance le flux  | `{ user }`      |
| `session/identity`      | **nouvelle** — `GET /auth/me` | `User`          |
| `session/clear`         | **devient `session/signOut`** | `{ revoked }`   |

Deux requêtes plutôt qu'une pour l'état de session, et c'est **la maquette qui
l'impose** : `session/status` est une lecture locale, instantanée, qui décide si
le panneau montre le pipeline ; `session/identity` est un aller-retour réseau qui
remplit l'avatar. La capture doit rester utilisable avant que le second réponde.

`revoked: false` signifie « parti d'ici, pas révoqué là-bas ». Le panneau s'en
sert pour afficher l'avertissement, et rien d'autre.

### Un échec de plus

`Failure` gagne `{ reason: 'cancelled' }` : l'utilisateur a fermé la fenêtre
Google. Ce n'est pas une panne et **rien ne doit s'afficher** — mais sans un cas
nommé, une annulation ressemblerait à une erreur serveur.

## L'identité dans le panneau

`SessionContext` expose désormais :

```typescript
interface SessionContextValue {
  connected: boolean;
  checking: boolean;
  user: User | null; // null tant que /auth/me n'a pas répondu
  signIn: () => Promise<void>; // plus de jeton en argument
  signOut: () => Promise<void>;
}
```

`User` est `{ id, email }` — **c'est tout ce que l'API sait**. Pas de nom, pas de
photo : `config/google.ts` ne lit que `sub` et `email` de l'`id_token`.

**L'avatar** est un cercle turquoise (`--accent`) portant l'initiale de l'e-mail
en majuscule. Toujours la même couleur : un seul compte est connecté à la fois,
une couleur dérivée ne distinguerait rien et emprunterait les teintes des
statuts.

Tant que `user` est `null`, le cercle **garde sa place** et respire. Il ne doit
pas apparaître d'un coup : la barre décalerait sous le curseur.

**Le menu** est le `Popover` existant : un en-tête (avatar, e-mail, « Connecté
sur cet appareil »), un filet, une entrée `Se déconnecter` en rouge.

## La déconnexion

En un seul temps — elle ne détruit aucune idée, et se reconnecter coûte un clic.

```
signOut()
  ├─ DELETE /auth/session  ─── succès ──▶ clearToken()  { revoked: true }
  └────────────────────────── échec ────▶ clearToken()  { revoked: false }
```

**On part dans les deux cas.** L'utilisateur a demandé à quitter cet appareil ;
lui refuser parce que le réseau est absent le laisserait connecté contre son gré,
ce qui est le pire des deux résultats. Quand `revoked` est faux, le panneau
revient à l'écran de connexion en affichant : la session reste ouverte à distance
jusqu'à son expiration.

Un `401` compte comme un succès : la session était déjà morte.

## Ce qui disparaît

- le champ de collage et le texte « étape provisoire » de `SignInScreen` ;
- `session/set` et `signIn(token)` ;
- le jeton fabriqué à la main comme moyen d'entrer — **y compris en
  développement**. Pour tester, on se connectera.

## Tests

Sans Chrome, trois choses sur quatre restent vérifiables.

| Quoi                                  | Comment                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| PKCE (verifier, challenge, base64url) | unitaire — `crypto.subtle` existe dans Node                 |
| Les trois appels de `api.ts`          | unitaire, `fetch` bouchonné, comme les six existants        |
| Les handlers `session/*` du worker    | unitaire, `chrome.identity` bouchonné                       |
| L'avatar et le menu                   | **à la main** — `@testing-library/react` n'est pas installé |

Le vecteur de test de PKCE est celui de la **RFC 7636** : un `code_verifier`
connu doit produire le `code_challenge` publié. Ça vaut mieux que de comparer le
code à lui-même.

## Dépendances

**Aucune.** `crypto.subtle`, `chrome.identity` et `fetch` sont natifs.

## Hors périmètre

- **L'écran profil** et les lignes « Membre depuis » / « Cet appareil » : la
  maquette les montre, la décision les écarte. Elles demanderaient d'exposer
  `users.created_at` et d'ajouter un endpoint pour `sessions.user_agent`.
- **Voir et révoquer ses autres appareils.** Aucun endpoint ne liste les
  sessions.
- **Le nom et la photo Google.** Le serveur ne les lit pas.
- **L'e-mail / mot de passe**, reporté depuis la brique auth.
- **L'hébergement OVH** : l'API reste locale, l'ID de l'extension ne dépend pas
  d'elle.
- **La reprise des idées de `chrome.storage.local`**, toujours en attente.
- **La publication sur le Chrome Web Store.** La `key` la prépare, elle ne la
  fait pas.

## Notes / Blocage

- **Tâche 0 pour le PO** : créer le client OAuth dans Google Cloud. Elle a besoin
  de l'ID produit par la `key`, donc elle vient **après** la première tâche, pas
  avant. Tout le reste est bloqué par elle.
- **Les trois valeurs qui doivent s'accorder** n'ont aucun garde-fou automatique.
  Si la divergence mord, le remède serait un `GET /auth/config` renvoyant
  `{ clientId, redirectUri }` depuis l'unique `.env` du serveur, l'extension
  vérifiant que le `redirectUri` reçu est bien le sien. C'est un endpoint de plus :
  on ne le construit pas tant que le problème est théorique.
- La `key` privée arrive dans le dépôt de travail sans être versionnée. Le
  `.gitignore` est la seule protection ; elle mérite d'être rangée ailleurs.
