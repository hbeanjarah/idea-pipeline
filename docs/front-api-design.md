# Liaison front ↔ API — conception

> Service worker détenteur unique du jeton · panneau sans accès au réseau
>
> **Périmètre : la liaison seule.** Le parcours Google fait l'objet d'une brique
> suivante ; ici, le jeton est **collé à la main**.

## Ce que cette brique change

L'extension cesse de lire `chrome.storage.local` et parle à l'API. Trois
conséquences à regarder en face avant de commencer :

1. **Les idées actuellement stockées en local disparaissent de l'interface.**
   Elles ne sont ni supprimées ni touchées — elles restent sur le disque — mais
   plus rien ne les affiche. Leur reprise est un script ultérieur, déjà acté.
2. **Chaque action peut désormais échouer visiblement.** C'est le vrai travail
   de la brique, pas le client HTTP.
3. **L'extension gagne une quatrième surface**, l'écran de connexion.

## Décisions actées

| Sujet                    | Décision                                                               |
| ------------------------ | ---------------------------------------------------------------------- |
| Architecture             | **Service worker seul détenteur du jeton** (motif BFF de la BCP OAuth) |
| Le panneau               | ne fait **aucun** appel réseau, ne voit **jamais** le jeton            |
| Stockage du jeton        | `chrome.storage.session` — en mémoire, jamais sur disque               |
| Au redémarrage de Chrome | reconnexion silencieuse — **brique suivante** ; ici, recoller le jeton |
| CORS                     | **aucun** en-tête serveur : `host_permissions` suffit                  |
| Obtention du jeton       | **collé à la main**, temporaire                                        |
| Mise à jour de l'état    | **pessimiste** — l'écran attend le serveur                             |
| Couleur d'échec          | `--danger`, étendue depuis la suppression                              |

### Pourquoi le service worker et pas le panneau

La BCP de l'IETF sur OAuth dans le navigateur ([RFC 10017]) est explicite :
_« Service workers […] have no access to the DOM, and the DOM has no access to
the service worker […]. This makes service workers the most secure place to
acquire and store tokens, as an XSS attack would be unable to exfiltrate the
tokens. »_ Son modèle de menace nomme le cas d'une **extension tierce** ou d'une
**dépendance compromise en amont** — pas seulement un XSS dans notre code.

Ce motif coûte cher dans un projet ordinaire. Ici, presque rien :
`IdeaRepository` est déjà une interface avec **un seul consommateur**. Toute la
plomberie tient dans une implémentation ; `IdeasProvider` ne change pas d'une
ligne pour cette raison.

[RFC 10017]: https://oauth.net/2/browser-based-apps/

## L'architecture

```
┌─ Panneau latéral (DOM) ─────────┐     ┌─ Service worker ──────────────┐
│  IdeasProvider                  │     │  session.ts  ← le jeton       │
│      ↓                          │     │      ↓                        │
│  MessagingIdeaRepository ──────▶│────▶│  api.ts  ──fetch──▶  API      │
│                                 │◀────│  messages.ts                  │
└─────────────────────────────────┘     └───────────────────────────────┘
```

| Fichier                         | Rôle                                                     |
| ------------------------------- | -------------------------------------------------------- |
| `src/lib/protocol.ts`           | le type du protocole, **partagé** par les deux contextes |
| `src/background/session.ts`     | le jeton : lecture, écriture, effacement                 |
| `src/background/api.ts`         | le client HTTP — **le seul `fetch` du projet**           |
| `src/background/messages.ts`    | le routeur : un message → une opération                  |
| `src/storage/remote.ts`         | `MessagingIdeaRepository implements IdeaRepository`      |
| `src/hooks/SessionProvider.tsx` | « y a-t-il une session ? », pour choisir la surface      |
| `src/screens/SignInScreen.tsx`  | la quatrième surface                                     |

`src/storage/storage.ts` **reste en place**. Son implémentation locale ne sert
plus l'interface, mais le script de reprise en aura besoin pour lire l'ancien
stockage. La supprimer maintenant détruirait le seul moyen de récupérer les
idées existantes.

## Le protocole

```typescript
// src/lib/protocol.ts
export type Request =
  | { kind: 'ideas/list' }
  | { kind: 'ideas/create'; text: string }
  | { kind: 'ideas/addVariation'; ideaId: string; text: string }
  | {
      kind: 'ideas/editVariation';
      ideaId: string;
      variationId: string;
      text: string;
    }
  | { kind: 'ideas/changeStatus'; ideaId: string; status: Status }
  | { kind: 'ideas/delete'; ideaId: string }
  | { kind: 'session/status' }
  | { kind: 'session/set'; token: string }
  | { kind: 'session/clear' };

export type Failure =
  | { reason: 'offline' }
  | { reason: 'unauthenticated' }
  | { reason: 'gone' }
  | { reason: 'rejected'; message: string }
  | { reason: 'server' };

// Ce que chaque requête répond. Sans cette table, l'appelant transtype à la
// main et une erreur de correspondance ne se voit qu'à l'exécution.
export interface ReplyData {
  'ideas/list': Idea[];
  'ideas/create': Idea;
  'ideas/addVariation': Idea;
  'ideas/editVariation': Idea;
  'ideas/changeStatus': Idea;
  'ideas/delete': void;
  'session/status': { connected: boolean };
  'session/set': { connected: boolean };
  'session/clear': void;
}

export type Reply<K extends Request['kind']> =
  | { ok: true; data: ReplyData[K] }
  | { ok: false; failure: Failure };
```

`Idea` et `Status` viennent de `src/storage/types.ts` — voir la note sur leur
dérive en fin de document.

**Une exception ne traverse pas `sendMessage`.** Si le worker lève, le panneau
reçoit `undefined`, pas une erreur — et un échec se présenterait alors comme un
succès contenant `undefined`. Le protocole transporte donc l'échec **comme une
valeur**, et `MessagingIdeaRepository` le reconvertit en `throw` pour que
`IdeasProvider` continue de voir ce qu'il a toujours vu.

Ce `throw` porte une classe dédiée :

```typescript
export class RepositoryError extends Error {
  readonly failure: Failure;
}
```

## Le jeton

Le worker est le seul à le détenir, dans `chrome.storage.session` : en mémoire,
jamais écrit sur disque, non exposé aux content scripts.

**Le worker meurt après ~30 s d'inactivité.** Ce n'est pas une anomalie, c'est
MV3. Il relit donc le jeton à chaque réveil — c'est l'usage pour lequel
`storage.session` existe. Aucune variable de module ne peut en tenir lieu.

**Son obtention est temporaire.** `SignInScreen` affiche, pour cette brique, un
champ « Colle ton jeton » et un bouton, qui envoient `session/set`. La brique
suivante remplace **ce seul morceau** par `launchWebAuthFlow` : tout le reste —
stockage, réhydratation, `401`, expiration — est définitif et sera éprouvé ici.

Au redémarrage de Chrome, `storage.session` est vidé : on retombe sur l'écran de
connexion. C'est pénible, et c'est assumé pour une étape de développement.

## Les échecs

### Ils ne se valent pas

| Cause                  | HTTP        | `reason`          | Conduite                                  |
| ---------------------- | ----------- | ----------------- | ----------------------------------------- |
| Serveur injoignable    | —           | `offline`         | message + **Réessayer**                   |
| Session morte          | `401`       | `unauthenticated` | → écran de connexion                      |
| Idée disparue ailleurs | `404`       | `gone`            | **recharge la liste**, information neutre |
| Corps refusé           | `400`       | `rejected`        | message du serveur, repris tel quel       |
| Panne serveur          | `500` `502` | `server`          | message + **Réessayer**                   |

Le `404` est nouveau : deux navigateurs peuvent maintenant diverger. Supprimer
une idée sur le portable la rend introuvable depuis le téléphone, qui l'affiche
encore. Réessayer n'y changera rien ; recharger, si. **Il s'affiche sur fond
neutre, pas en rouge** : rien n'a raté.

### La règle qui prime

> **Un texte saisi ne disparaît jamais parce que le réseau a échoué.**

C'est un outil de capture. Perdre une idée qu'on vient d'écrire serait _pire que
l'ancien comportement local_, et disqualifierait la bascule. En pratique : le
champ garde son contenu, reste éditable, et **Réessayer** renvoie le même texte.
Rien n'est effacé avant confirmation du serveur.

C'est aussi pourquoi l'échec s'affiche **sous** le champ et jamais en modale :
une modale volerait le focus et l'endroit où on en était.

### Pas de mise à jour optimiste

L'état n'avance qu'après confirmation. L'optimisme imposerait d'annuler
proprement en cas d'échec — un sous-système de rollback pour gagner quelques
dizaines de millisecondes.

### Le `401` est le seul cas traité en silence

Une session expirée n'est pas une décision d'utilisateur. Dans **cette** brique,
il n'y a rien à rejouer : on efface le jeton et on affiche la connexion. Le
rejeu après reconnexion silencieuse arrive avec Google.

Une seule tentative, jamais une boucle.

## L'interface

`design/mockup-auth.html` fait foi — sept états, validés. `IdeasProvider` gagne
un état d'échec exposant **quelle** opération a échoué et **comment** la
rejouer ; sans ça chaque écran réinventerait sa gestion d'erreur et ils
divergeraient.

`App.tsx` choisit la surface : pas de session → `SignInScreen`, sinon
l'application.

## Le manifeste

```typescript
host_permissions: ['http://localhost:3000/*'],
```

C'est ce qui **dispense de CORS** : une page d'extension atteint un hôte de ses
`host_permissions` sans qu'aucun en-tête ne soit produit côté serveur. Le sujet,
ouvert depuis des semaines, disparaît.

Une `key` fixant l'ID de l'extension n'est **pas** nécessaire ici — elle le
deviendra pour l'URL de redirection Google.

L'adresse de l'API vit dans une constante unique. L'hébergement la rendra
configurable ; ce n'est pas le sujet aujourd'hui.

## Tests

Le harnais front simule aujourd'hui `chrome.storage` seul. Il faut y ajouter
`chrome.runtime`, et `fetch` pour le côté worker.

- **`MessagingIdeaRepository`** : chaque `Reply` `ok: false` devient le bon
  `RepositoryError`. Le cas qui compte : un `undefined` en retour de
  `sendMessage` — worker mort ou levée non rattrapée — ne doit **pas** passer
  pour un succès.
- **`api.ts`** : chaque statut HTTP donne le bon `reason`, et un `fetch` qui
  rejette donne `offline`.
- **`session.ts`** : écriture, relecture après « réveil », effacement.
- **`IdeasProvider`** : sur échec de `create`, l'idée **n'entre pas** dans la
  liste et l'échec est exposé — la garantie « texte jamais perdu » vue du code.

## Dépendances

**Aucune.** `fetch` est natif, `chrome.runtime` et `chrome.storage` sont des API
de plateforme.

## Hors périmètre

- **Le parcours Google** et la reconnexion silencieuse : brique suivante.
- **Le script de reprise** des idées du stockage local.
- **L'hébergement OVH.**
- **L'écriture hors ligne et la synchronisation** : reportées.
- **La `key` du manifeste** : inutile tant qu'il n'y a pas de redirection.

## Notes / Blocage

- **`src/storage/types.ts` est écrit à la main** et duplique le modèle du
  contrat. Tant que le front ne parlait à personne, la dérive était sans
  conséquence ; elle devient un risque d'exécution. Générer ces types depuis
  `docs/openapi.yaml`, comme le serveur, est une brique à ouvrir.
- **`tokens.css` commente `--danger` comme « reserved for destructive actions
  (delete) »** — faux dès cette brique. À corriger avec le code.
- **`structure.md` ne connaît ni `src/lib/protocol.ts`, ni `src/background/`
  au-delà du service worker.** À mettre à jour en fermant la brique.
