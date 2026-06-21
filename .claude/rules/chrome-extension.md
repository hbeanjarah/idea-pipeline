---
description: Contraintes Manifest V3, Side Panel, permissions, et verrou d'ouverture du panneau.
paths:
  - 'src/manifest.ts'
  - 'src/background/**'
---

# Extension Chrome (MV3)

## Manifest V3

- **Service worker** comme background (`src/background/index.ts`) — jamais de
  background page persistante. Le worker est **éphémère** : Chrome peut le tuer
  à tout moment. Aucun état durable en mémoire dans le worker ; tout passe par
  `chrome.storage.local` (voir `storage.md`).
- **Aucun code distant** : tout le JS est bundlé par Vite. Pas de script
  externe, pas d'`eval`, pas de CDN (CSP MV3 stricte).
- Manifest typé en TypeScript (`src/manifest.ts`), généré par
  `@crxjs/vite-plugin`.

## Permissions — minimales

Le MVP ne demande que le strict nécessaire :

- `storage` — persistance locale.
- `sidePanel` — la surface de l'app.
- `commands` — le raccourci clavier d'ouverture.

**Pas** de `host_permissions`, **pas** de content script, **pas** d'accès au DOM
des pages. L'extension est un panneau **autonome** : elle ne lit ni n'écrit dans
les pages visitées (LinkedIn compris). Toute interaction avec une page serait un
ajout hors-MVP, via ticket.

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
