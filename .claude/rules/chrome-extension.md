---
description: Contraintes Manifest V3, Side Panel, permissions, et verrou d'ouverture du panneau.
paths:
  - "src/manifest.ts"
  - "src/background/**"
---

# Extension Chrome (MV3)

## Manifest V3

- **Service worker** comme background (`src/background/`) — jamais de background
  page persistante. Le worker est **éphémère** : Chrome peut le tuer à tout
  moment. **Aucun état en mémoire** : le jeton de session se relit à chaque
  réveil dans `chrome.storage.session`, une variable de module ne survivrait pas.
  Exception connue : `launchWebAuthFlow` fait partie des rares API exemptées du
  minuteur, et peut donc porter un flux qui attend l'utilisateur.
- Le worker est **le seul à parler au réseau** et **le seul à détenir le jeton**.
  Le panneau lui envoie des messages (`src/lib/protocol.ts`).
- **Aucun code distant** : tout le JS est bundlé par Vite. Pas de script
  externe, pas d'`eval`, pas de CDN (CSP MV3 stricte).
- Manifest typé en TypeScript (`src/manifest.ts`), généré par
  `@crxjs/vite-plugin`.

## Permissions — minimales

Le MVP ne demande que le strict nécessaire :

- `storage` — le jeton de session, et les idées d'avant la bascule.
- `sidePanel` — la surface de l'app.
- `identity` — la connexion Google, par `launchWebAuthFlow`.
- `commands` — le raccourci clavier d'ouverture.

Un **`host_permissions`** est déclaré, sur la seule adresse de l'API. C'est lui
qui exempte les pages de l'extension de CORS : aucun en-tête n'est produit côté
serveur, c'est le navigateur qui accorde l'accès. Il est **construit depuis
l'adresse résolue** (`src/manifest.ts`), pour qu'il ne puisse pas diverger de
celle que le worker appelle.

Le manifest porte aussi une **`key`**, qui fixe l'ID de l'extension — l'URL de
redirection Google en dépend. Sa moitié privée (`key.pem`) n'est pas versionnée.

**Pas** de content script, **pas** d'accès au DOM des pages. L'extension est un
panneau **autonome** : elle ne lit ni n'écrit dans les pages visitées (LinkedIn
compris). Toute interaction avec une page serait un ajout hors-MVP, via ticket.

## Ouverture du panneau — verrou

Le panneau ne s'ouvre **que sur action explicite de l'utilisateur** : clic sur
l'icône de l'extension, ou raccourci clavier.

- `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.
- **Interdit** : ouvrir le panneau depuis un événement de fond (démarrage de
  Chrome, navigation, timer, message entrant). Aucune API ne doit déclencher
  l'ouverture sans geste de l'utilisateur. C'est une garantie de non-intrusion,
  pas une préférence.

## Raccourci clavier (multi-OS)

Défini dans `commands`. Seul `suggested_key` diffère par plateforme, le reste du
code est identique :

- Windows / Linux : `Ctrl+Shift+…`
- macOS : `Command+Shift+…`

La combinaison exacte est fixée à l'init, en évitant les raccourcis déjà pris
par Chrome.
