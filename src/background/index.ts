// Ephemeral MV3 service worker. No durable in-memory state — Chrome may stop it
// at any time. Its only job here: open the side panel, and only on an explicit
// user action (icon click or keyboard shortcut). Never auto-open from a
// background event — that lock is a non-intrusion guarantee, not a preference.

import { handle } from './messages';
import type { Request } from '../lib/protocol';

// Icon click opens the side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Keyboard shortcut opens the side panel. onCommand is a user gesture, so
// sidePanel.open() is allowed here.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'open-panel') return;
  if (tab?.windowId === undefined) return;
  chrome.sidePanel
    .open({ windowId: tab.windowId })
    .catch((error) => console.error(error));
});

// Returning true keeps the message channel open for the async answer. Without
// it the panel receives undefined, which reads as an empty success.
chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse) => {
    void handle(request as Request).then(sendResponse);
    return true;
  },
);
